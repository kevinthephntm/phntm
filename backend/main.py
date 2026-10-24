import asyncio
import json
import queue
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import run_task
from watcher import watch

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

events: queue.Queue[dict] = queue.Queue()
stop = threading.Event()
worker: threading.Thread | None = None
threading.Thread(target=watch, args=(events.put,), daemon=True).start()


class Task(BaseModel):
    text: str


class Event(BaseModel):
    type: str
    text: str


@app.post("/event")
def push_event(ev: Event):
    events.put(ev.model_dump())
    return {"ok": True}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/task")
def start_task(task: Task):
    global worker
    if worker and worker.is_alive():
        stop.set()
        worker.join(timeout=10)
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
