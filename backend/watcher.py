import os
import sqlite3
import subprocess
import time
from collections.abc import Callable
from pathlib import Path

from dotenv import load_dotenv

from facetime import call

load_dotenv()

DB = Path.home() / "Library/Messages/chat.db"
KEYWORD = "ft me"
POLL_SECONDS = 5


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


def watch(emit: Callable[[dict], None]) -> None:
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
    emit({"type": "status", "text": f"watching iMessage for '{KEYWORD}'"})
    while True:
        rows = conn.execute(
            "SELECT ROWID, text, attributedBody FROM message WHERE ROWID > ? AND is_from_me = 1 ORDER BY ROWID",
            (last,),
        ).fetchall()
        for rowid, text, body in rows:
            last = rowid
            if (text or decode_body(body or b"")).strip().lower() != KEYWORD:
                continue
            emit({"type": "facetime", "text": f"'{KEYWORD}' received, FaceTiming {number}"})
            try:
                call(number)
            except subprocess.CalledProcessError:
                emit({"type": "message", "text": "FaceTime opened but clicking Call failed"})
        time.sleep(POLL_SECONDS)
