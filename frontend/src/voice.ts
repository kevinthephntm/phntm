const API = 'http://127.0.0.1:8000';

export type Mode = 'mac' | 'facetime';
export type Voice = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  mic: MediaStream;
};

type Handlers = {
  onStatus: (text: string) => void;
  onTask: (task: string) => void;
};

type ServerEvent =
  | {
      type: 'response.function_call_arguments.done';
      name: string;
      call_id: string;
      arguments: string;
    }
  | { type: 'response.output_audio_transcript.done'; transcript: string }
  | {
      type: 'conversation.item.input_audio_transcription.completed';
      transcript: string;
    }
  | { type: 'error'; error: { message: string } };

export async function connect(mode: Mode, h: Handlers): Promise<Voice> {
  const token = (await fetch(`${API}/voice/token`).then((r) => r.json())) as {
    value: string;
  };
  let mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audio = new Audio();
  audio.autoplay = true;
  if (mode === 'facetime') {
    // FaceTime's speaker output lands on BlackHole 2ch, our voice goes out on BlackHole 16ch (FaceTime's mic)
    const all = await navigator.mediaDevices.enumerateDevices();
    const input = all.find(
      (d) => d.kind === 'audioinput' && d.label.startsWith('BlackHole 2ch'),
    );
    const output = all.find(
      (d) => d.kind === 'audiooutput' && d.label.startsWith('BlackHole 16ch'),
    );
    if (!input || !output)
      throw new Error('BlackHole 2ch + 16ch not found, see README');
    mic.getTracks().forEach((t) => t.stop());
    mic = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: input.deviceId } },
    });
    await audio.setSinkId(output.deviceId);
  }
  const pc = new RTCPeerConnection();
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
  };
  pc.addTrack(mic.getTracks()[0], mic);
  const dc = pc.createDataChannel('oai-events');
  dc.onmessage = (e) => handle(JSON.parse(e.data) as ServerEvent, dc, h);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const res = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.value}`,
      'Content-Type': 'application/sdp',
    },
    body: offer.sdp,
  });
  const answer = await res.text();
  if (!res.ok) throw new Error(`realtime ${res.status}: ${answer}`);
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  console.log('[voice] connected');
  return { pc, dc, mic };
}

export function disconnect(v: Voice): void {
  v.mic.getTracks().forEach((t) => t.stop());
  v.pc.close();
}

export function say(v: Voice, instructions: string): void {
  v.dc.send(
    JSON.stringify({ type: 'response.create', response: { instructions } }),
  );
}

async function handle(
  ev: ServerEvent,
  dc: RTCDataChannel,
  h: Handlers,
): Promise<void> {
  switch (ev.type) {
    case 'response.function_call_arguments.done': {
      let output = 'stopped';
      if (ev.name === 'run_task') {
        const { task } = JSON.parse(ev.arguments) as { task: string };
        h.onTask(task);
        const res = await fetch(`${API}/task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: task }),
        });
        output = res.ok
          ? 'started'
          : ((await res.json()) as { detail: string }).detail;
      } else {
        await fetch(`${API}/stop`, { method: 'POST' });
      }
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: ev.call_id, output },
        }),
      );
      dc.send(JSON.stringify({ type: 'response.create' }));
      return;
    }
    case 'conversation.item.input_audio_transcription.completed':
      h.onVoice(`you: ${ev.transcript}`);
      return;
    case 'response.output_audio_transcript.done':
      h.onVoice(ev.transcript);
      return;
    case 'error':
      h.onStatus(`voice error: ${ev.error.message}`);
      return;
  }
}
