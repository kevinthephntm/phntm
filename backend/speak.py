import json
import os
import urllib.request

import sounddevice as sd

API = "https://api.elevenlabs.io/v1/text-to-speech"
RATE = 24000
DEVICE = "BlackHole 16ch"  # FaceTime's microphone is routed here, so the caller hears this


def speak(text: str) -> None:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key or not text.strip():
        return
    voice = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    model = os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5")
    req = urllib.request.Request(
        f"{API}/{voice}?output_format=pcm_24000",
        data=json.dumps({"text": text, "model_id": model}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp, sd.RawOutputStream(
        device=DEVICE, samplerate=RATE, channels=1, dtype="int16"
    ) as out:
        while chunk := resp.read(RATE // 10 * 2):
            out.write(chunk)
