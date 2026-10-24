import { useEffect, useRef, useState } from 'react';
import { connect, disconnect, say, type Mode, type Voice } from './voice';

const API = 'http://127.0.0.1:8000';

type Event = {
  type: 'status' | 'action' | 'message' | 'facetime';
  text: string;
};

const taskEnded = (ev: Event) =>
  ev.type === 'status' &&
  (ev.text === 'done' ||
    ev.text.startsWith('stopped') ||
    ev.text.startsWith('error'));

export function App() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [voiceLine, setVoiceLine] = useState('');
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>('mac');
  const [listening, setListening] = useState(false);
  const voice = useRef<Voice | null>(null);
  const lastMessage = useRef('');

  const startVoice = async (m: Mode) => {
    if (voice.current) disconnect(voice.current);
    setMode(m);
    setStatus('connecting…');
    try {
      voice.current = await connect(m, {
        onStatus: setStatus,
        onTask: setText,
      });
      setListening(true);
      setStatus(m === 'facetime' ? 'listening on FaceTime' : 'listening');
    } catch (e) {
      console.error('[voice] connect failed', e);
      setStatus(String(e));
    }
  };

  const stopVoice = () => {
    if (voice.current) disconnect(voice.current);
    voice.current = null;
    setListening(false);
    setStatus('');
    setVoiceLine('');
  };

  useEffect(() => {
    const es = new EventSource(`${API}/events`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data) as Event;
      setStatus(ev.text);
      if (ev.type === 'message') lastMessage.current = ev.text;
      if (ev.type === 'status') setRunning(ev.text === 'running');
      if (ev.type === 'facetime') startVoice('facetime');
      if (taskEnded(ev) && voice.current) {
        say(
          voice.current,
          `The task just finished. Result: ${lastMessage.current || ev.text}. Tell the user in one short sentence.`,
        );
      }
    };
    return () => es.close();
  }, []);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await fetch(`${API}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  };

  const stop = () => fetch(`${API}/stop`, { method: 'POST' });

  const toggleMode = () => {
    const m: Mode = mode === 'mac' ? 'facetime' : 'mac';
    setMode(m);
    if (listening) startVoice(m);
  };

  return (
    <div className="bar">
      <div className="row">
        <button
          className={`mic ${listening ? 'on' : ''}`}
          onClick={() => (listening ? stopVoice() : startVoice(mode))}
          title="Voice"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2z" />
          </svg>
        </button>
        <form onSubmit={run}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or talk…"
            disabled={running}
          />
        </form>
        {running && (
          <button className="stop" onClick={stop}>
            Stop
          </button>
        )}
        <button
          className="mode"
          onClick={toggleMode}
          title="Where to listen: Mac mic or the FaceTime call"
        >
          {mode === 'mac' ? 'Mac' : 'FaceTime'}
        </button>
      </div>
      <div className="status voice">{voiceLine}</div>
      <div className="status">{status}</div>
    </div>
  );
}
