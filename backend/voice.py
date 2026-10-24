from dotenv import load_dotenv
from fastapi import APIRouter
from openai import OpenAI

load_dotenv()
router = APIRouter()
client = OpenAI()
MODEL = "gpt-realtime-2.1"

INSTRUCTIONS = """You are the voice of an assistant that controls this Mac.
When the user asks for anything to be done on the computer, call run_task with a clear, complete description of the task.
If they say stop, call stop_task.
Speak in one short sentence. Never read long text aloud."""

TOOLS = [
    {
        "type": "function",
        "name": "run_task",
        "description": "Start doing a task on the Mac.",
        "parameters": {"type": "object", "properties": {"task": {"type": "string"}}, "required": ["task"]},
    },
    {
        "type": "function",
        "name": "stop_task",
        "description": "Stop the task that is currently running.",
        "parameters": {"type": "object", "properties": {}},
    },
]


@router.get("/voice/token")
def voice_token():
    # short-lived key so the real API key never reaches the Electron app
    secret = client.realtime.client_secrets.create(
        session={
            "type": "realtime",
            "model": MODEL,
            "instructions": INSTRUCTIONS,
            "tools": TOOLS,
            "audio": {
                "input": {"turn_detection": {"type": "semantic_vad"}, "transcription": {"model": "gpt-4o-transcribe"}},
                "output": {"voice": "marin"},
            },
        }
    )
    return {"value": secret.value}
