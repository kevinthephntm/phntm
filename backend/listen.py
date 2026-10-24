import base64
import json
import queue
import threading
import time
import urllib.request
from collections.abc import Callable

import sounddevice as sd
from openai import OpenAI

import imessage
from voice import INSTRUCTIONS, MODEL, TOOLS

API = "http://127.0.0.1:8000"
RATE = 24000
DEVICE = "BlackHole 2ch"  # FaceTime's speaker output is routed here, so this is the caller's voice


def post(number: str, path: str, body: dict) -> None:
    req = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        imessage.send(number, f"🤖 {json.loads(e.read())['detail']}")
    except urllib.error.URLError:
        imessage.send(number, "🤖 backend is not running")


def listen(number: str, emit: Callable[[dict], None], in_call: Callable[[], bool]) -> None:
    chunks: queue.Queue[bytes | None] = queue.Queue()
    client = OpenAI()
    with (
        client.realtime.connect(model=MODEL) as conn,
        sd.RawInputStream(device=DEVICE, samplerate=RATE, channels=1, dtype="int16", blocksize=RATE // 10, callback=lambda data, *_: chunks.put(bytes(data))),
    ):
        conn.session.update(session={
            "type": "realtime",
            "instructions": INSTRUCTIONS,
            "tools": TOOLS,
            "output_modalities": ["text"],
            "audio": {"input": {"turn_detection": {"type": "semantic_vad", "eagerness": "high"}, "transcription": {"model": "gpt-4o-transcribe"}}},
        })

        def pump() -> None:
            while (data := chunks.get()) is not None:
                conn.input_audio_buffer.append(audio=base64.b64encode(data).decode())

        def hangup_watch() -> None:
            connected = False
            while True:
                time.sleep(5)
                if in_call():
                    connected = True
                elif connected:
                    break
            chunks.put(None)
            conn.close()

        threading.Thread(target=pump, daemon=True).start()
        threading.Thread(target=hangup_watch, daemon=True).start()
        emit({"type": "status", "text": "listening on the FaceTime call"})
        for ev in conn:
            match ev.type:
                case "conversation.item.input_audio_transcription.completed":
                    emit({"type": "heard", "text": ev.transcript})
                case "response.function_call_arguments.done":
                    if ev.name == "run_task":
                        task = json.loads(ev.arguments)["task"]
                        emit({"type": "message", "text": f"task: {task}"})
                        imessage.send(number, f"🤖 on it: {task}")
                        post(number, "/task", {"text": task})
                    else:
                        post(number, "/stop", {})
                    conn.conversation.item.create(item={"type": "function_call_output", "call_id": ev.call_id, "output": "ok"})
                    conn.response.create()
                case "error":
                    emit({"type": "status", "text": f"voice error: {ev.error.message}"})
    emit({"type": "status", "text": "call ended"})
