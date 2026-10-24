import os
import sqlite3
import subprocess
import threading
import time
from collections.abc import Callable
from pathlib import Path

from dotenv import load_dotenv

import facetime
import imessage
from listen import listen, post

load_dotenv()

DB = Path.home() / "Library/Messages/chat.db"
KEYWORD = "ft me"
POLL_SECONDS = 1
Emit = Callable[[dict], None]


def decode_body(blob: bytes) -> str:
    # macOS keeps the text in an NSAttributedString typedstream: "NSString" + 5 header bytes, then a length-prefixed utf-8 string
    i = blob.find(b"NSString")
    if i == -1:
        return ""
    i += len(b"NSString") + 5
    n = blob[i]
    if n == 0x81:
        n, i = int.from_bytes(blob[i + 1 : i + 3], "little"), i + 3
    else:
        i += 1
    return blob[i : i + n].decode("utf-8", errors="replace")


def camera_off(emit: Emit) -> None:
    time.sleep(4)  # the video controls only show up once FaceTime has started the camera preview
    try:
        facetime.camera_off()
        emit({"type": "status", "text": "mac camera off"})
    except RuntimeError as e:
        emit({"type": "status", "text": f"could not turn the camera off: {e}"})


def start_call(number: str, emit: Emit) -> None:
    try:
        facetime.call(number)
        emit({"type": "status", "text": f"calling {number}"})
        facetime.route_audio_to_blackhole()
        threading.Thread(target=camera_off, args=(emit,), daemon=True).start()
        listen(number, emit, facetime.in_call)
    except (subprocess.CalledProcessError, RuntimeError) as e:
        emit({"type": "status", "text": f"call failed: {e}"})
        imessage.send(number, f"🤖 call failed: {e}")


def watch(emit: Emit) -> None:
    number = os.environ.get("SELF_NUMBER")
    if not number:
        emit({"type": "status", "text": "iMessage watch off: set SELF_NUMBER in backend/.env"})
        return
    try:
        conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        last = conn.execute("SELECT COALESCE(MAX(ROWID), 0) FROM message").fetchone()[0]
    except sqlite3.OperationalError:
        emit({"type": "status", "text": "iMessage watch off: give your terminal Full Disk Access, then restart the backend"})
        return
    emit({"type": "status", "text": f"watching iMessage: '{KEYWORD}' calls you, any other text is a task"})
    while True:
        # only texts you sent in the conversation with yourself
        rows = conn.execute(
            """SELECT m.ROWID, m.text, m.attributedBody FROM message m
               JOIN chat_message_join j ON j.message_id = m.ROWID
               JOIN chat c ON c.ROWID = j.chat_id
               WHERE m.ROWID > ? AND m.is_from_me = 1 AND c.chat_identifier = ? ORDER BY m.ROWID""",
            (last, number),
        ).fetchall()
        for rowid, text, body in rows:
            last = rowid
            msg = (text or decode_body(body or b"")).strip()
            if not msg or msg.startswith("🤖"):
                continue
            if msg.lower() == KEYWORD:
                threading.Thread(target=start_call, args=(number, emit), daemon=True).start()
                continue
            emit({"type": "message", "text": f"task from iMessage: {msg}"})
            imessage.send(number, f"🤖 on it: {msg}")
            post(number, "/task", {"text": msg})
        time.sleep(POLL_SECONDS)
