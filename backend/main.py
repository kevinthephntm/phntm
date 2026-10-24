import asyncio
import json
import queue
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import run_task
from voice import router as voice_router
from watcher import watch

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(voice_router)

events: queue.Queue[dict] = queue.Queue()
stop = threading.Event()
worker: threading.Thread | None = None
threading.Thread(target=watch, args=(events.put,), daemon=True).start()


class Task(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/task")
def start_task(task: Task):
    global worker
    if worker and worker.is_alive():
        raise HTTPException(409, "a task is already running")
    stop.clear()
    worker = threading.Thread(target=run_task, args=(task.text, events.put, stop), daemon=True)
    worker.start()
    return {"ok": True}


@app.post("/stop")
def stop_task():
    stop.set()
    return {"ok": True}


@app.get("/events")
async def event_stream():
    async def gen():
        while True:
            try:
                ev = await asyncio.to_thread(events.get, True, 1)
            except queue.Empty:
                yield ": ping\n\n"
                continue
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
