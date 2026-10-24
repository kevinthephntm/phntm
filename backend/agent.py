import base64
import io
import json
import os
import subprocess
import threading
import time
from collections.abc import Callable

import pyautogui
from dotenv import load_dotenv
from openai import OpenAI
from openai.types.responses import ResponseComputerToolCall
from openai.types.responses.computer_action import ComputerAction

load_dotenv()
assert os.environ.get("OPENAI_API_KEY"), "OPENAI_API_KEY missing, put it in backend/.env"

client = OpenAI()
MODEL = os.environ.get("OPENAI_MODEL", "gpt-6.1-sol")
WIDTH, HEIGHT = pyautogui.size()
MAX_TURNS = 60

INSTRUCTIONS = f"""You are controlling a real macOS desktop ({WIDTH}x{HEIGHT}).
To open or switch to an app, ALWAYS call open_app with its exact name (e.g. "Google Chrome", "Notes", "Safari"). Never use Spotlight.
Use macOS conventions: Cmd shortcuts, Cmd+L for the browser address bar.
Act decisively. Do not ask for confirmation. When the task is finished, reply with one short sentence saying what you did."""

TOOLS = [
    {"type": "computer"},
    {
        "type": "function",
        "name": "open_app",
        "description": "Open or focus a macOS app by its exact name. Use this instead of Spotlight.",
        "parameters": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

KEYS = {
    "cmd": "command", "super": "command", "win": "command", "meta": "command",
    "ctrl": "ctrl", "control": "ctrl", "alt": "option", "option": "option", "shift": "shift",
    "enter": "enter", "return": "enter", "esc": "esc", "escape": "esc",
    "backspace": "backspace", "delete": "delete", "tab": "tab", "space": "space",
    "arrowup": "up", "arrowdown": "down", "arrowleft": "left", "arrowright": "right",
    "up": "up", "down": "down", "left": "left", "right": "right",
    "pageup": "pageup", "pagedown": "pagedown", "home": "home", "end": "end",
}

Emit = Callable[[dict], None]


def key(name: str) -> str:
    return KEYS.get(name.lower(), name.lower())


def screenshot_data_url() -> str:
    img = pyautogui.screenshot().resize((WIDTH, HEIGHT))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def execute(a: ComputerAction) -> None:
    held = [key(k) for k in (getattr(a, "keys", None) or [])] if a.type != "keypress" else []
    for k in held:
        pyautogui.keyDown(k)
    match a.type:
        case "click":
            pyautogui.click(a.x, a.y, button=a.button if a.button in ("left", "right") else "middle")
        case "double_click":
            pyautogui.doubleClick(a.x, a.y)
        case "move":
            pyautogui.moveTo(a.x, a.y)
        case "drag":
            pyautogui.moveTo(a.path[0].x, a.path[0].y)
            pyautogui.mouseDown()
            for p in a.path[1:]:
                pyautogui.moveTo(p.x, p.y, duration=0.2)
            pyautogui.mouseUp()
        case "scroll":
            pyautogui.moveTo(a.x, a.y)
            if a.scroll_y:
                pyautogui.scroll(-a.scroll_y // 20)
            if a.scroll_x:
                pyautogui.hscroll(a.scroll_x // 20)
        case "keypress":
            keys = [key(k) for k in a.keys]
            pyautogui.hotkey(*keys) if len(keys) > 1 else pyautogui.press(keys[0])
        case "type":
            pyautogui.write(a.text, interval=0.01)
        case "wait":
            time.sleep(1)
        case "screenshot":
            pass
        case _:
            raise ValueError(f"unknown action {a.type}")
    for k in reversed(held):
        pyautogui.keyUp(k)


def open_app(name: str) -> str:
    r = subprocess.run(["open", "-a", name], capture_output=True, text=True)
    time.sleep(1.5)
    return "opened" if r.returncode == 0 else f"failed: {r.stderr.strip()}"


def describe(a: ComputerAction) -> str:
    fields = a.model_dump(exclude={"type"}, exclude_none=True)
    return a.type if not fields else f"{a.type} {json.dumps(fields)}"


def run_task(task: str, emit: Emit, stop: threading.Event) -> None:
    emit({"type": "status", "text": "running"})
    try:
        resp = client.responses.create(
            model=MODEL,
            instructions=INSTRUCTIONS,
            tools=TOOLS,
            input=[{"role": "user", "content": [
                {"type": "input_text", "text": task},
                {"type": "input_image", "image_url": screenshot_data_url(), "detail": "original"},
            ]}],
        )
        for _ in range(MAX_TURNS):
            outputs: list[dict] = []
            for item in resp.output:
                if stop.is_set():
                    emit({"type": "status", "text": "stopped"})
                    return
                if item.type == "message":
                    for c in item.content:
                        if c.type == "output_text":
                            emit({"type": "message", "text": c.text})
                elif item.type == "function_call":
                    assert item.name == "open_app", item.name
                    name = json.loads(item.arguments)["name"]
                    emit({"type": "action", "text": f"open_app {name}"})
                    outputs.append({"type": "function_call_output", "call_id": item.call_id, "output": open_app(name)})
                elif isinstance(item, ResponseComputerToolCall):
                    for a in item.actions or [item.action]:
                        emit({"type": "action", "text": describe(a)})
                        execute(a)
                    time.sleep(0.8)
                    outputs.append({
                        "type": "computer_call_output",
                        "call_id": item.call_id,
                        "output": {"type": "computer_screenshot", "image_url": screenshot_data_url(), "detail": "original"},
                        "acknowledged_safety_checks": [{"id": s.id, "code": s.code, "message": s.message} for s in (item.pending_safety_checks or [])],
                    })
            if not outputs:
                emit({"type": "status", "text": "done"})
                return
            resp = client.responses.create(
                model=MODEL,
                instructions=INSTRUCTIONS,
                tools=TOOLS,
                previous_response_id=resp.id,
                input=outputs,
            )
        emit({"type": "status", "text": "stopped: hit turn limit"})
    except Exception as e:
        emit({"type": "status", "text": f"error: {e}"})
