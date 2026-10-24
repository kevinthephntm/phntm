# phntm — Requirements

phntm lets you control your Mac remotely: text yourself on iMessage, the Mac FaceTimes your phone, and you tell it what to do by voice while you watch the shared screen. It also takes typed tasks at the desk.

Requirement IDs (`R1.2`) are referenced from [design.md](design.md) and [tasks.md](tasks.md). Acceptance criteria use the form *WHEN … THE SYSTEM SHALL …*.

Status: **Done** = in `main` today, **Partial** = some criteria met, **Todo** = not built yet.

---

## R1. Run a task on the Mac (computer-use agent) — Done

**User story:** As the user, I want to describe a task in plain English and have the Mac do it, so I don't have to drive the mouse and keyboard myself.

1. WHEN a task is submitted to `POST /task` THE SYSTEM SHALL take a screenshot and send the task plus screenshot to the OpenAI computer-use model.
2. WHEN the model returns computer actions (click, double_click, move, drag, scroll, keypress, type, wait, screenshot) THE SYSTEM SHALL execute them with real mouse/keyboard input and return a fresh screenshot.
3. WHEN the model calls `open_app` or `open_url` THE SYSTEM SHALL open the app/URL with macOS `open` instead of driving Spotlight or the address bar.
4. WHEN the model returns no further actions THE SYSTEM SHALL emit `done` and its final message.
5. WHEN a task runs more than 60 model turns THE SYSTEM SHALL stop and report that it hit the turn limit.
6. WHEN a new task is submitted while one is running THE SYSTEM SHALL stop the running task before starting the new one (new task takes over).
7. WHEN `POST /stop` is called THE SYSTEM SHALL stop the running task before its next action.
8. WHEN anything in the loop raises THE SYSTEM SHALL emit an `error: …` status instead of crashing the backend.
9. THE SYSTEM SHALL never click its own status island or edge glow.

## R2. Live status for the user (island + glow) — Partial

**User story:** As the user, I want to see at a glance what phntm is doing, both at my desk and from my phone through the shared screen.

1. THE SYSTEM SHALL show an always-on-top pill at the bottom centre of the primary display, on every Space including fullscreen apps.
2. THE SYSTEM SHALL show exactly one phase at a time: Idle, Calling, Listening, Thinking, Working · step N, Done, Stopped, Error.
3. WHEN the agent performs an action THE SYSTEM SHALL show a human-readable step (e.g. "Typing “hello”", "Pressing ⌘L", "Opening github.com").
4. WHEN a task ends in Done or Stopped THE SYSTEM SHALL return to Idle (or Listening if on a call) after 6 seconds.
5. THE SYSTEM SHALL light the screen edges to match the phase (white listening, red working, amber calling, green done) in a click-through window that never takes focus.
6. **Todo:** WHEN the caller's speech is transcribed during a call THE SYSTEM SHALL grow the island into a card with a large caption of what was heard, then shrink back. *(Backend emits `heard` events; the UI currently ignores them.)*
7. Text SHALL be large and high-contrast enough to read on a phone screen through FaceTime screen share.

## R3. Type a task at the desk — Done

1. WHEN the user presses Cmd+Shift+Space THE SYSTEM SHALL focus the island and reveal a text box.
2. WHEN the user presses Enter THE SYSTEM SHALL submit the text as a task.
3. WHEN the user presses Esc THE SYSTEM SHALL stop a running task (if any) and unfocus the island.
4. WHILE a task is running THE SYSTEM SHALL show a Stop button.
5. WHILE on a FaceTime call THE SYSTEM SHALL hide the text box.

## R4. iMessage trigger — Done

**User story:** As the user away from my Mac, I want to text myself to start a call or a task.

1. WHEN `SELF_NUMBER` is set and the terminal has Full Disk Access THE SYSTEM SHALL watch `~/Library/Messages/chat.db` (read-only) for new messages the user sent in the chat with themselves.
2. WHEN a new self-message equals `ft me` (case-insensitive) THE SYSTEM SHALL start the FaceTime flow (R5).
3. WHEN any other non-empty self-message arrives THE SYSTEM SHALL reply `🤖 on it: <task>` and run it as a task.
4. THE SYSTEM SHALL ignore messages starting with `🤖` so it never reacts to its own replies.
5. THE SYSTEM SHALL only process messages newer than the backend's start time (no replay of history).
6. WHEN `SELF_NUMBER` is missing or chat.db can't be opened THE SYSTEM SHALL emit a status explaining which setting/permission to fix.
7. THE SYSTEM SHALL decode message text stored only in `attributedBody` (newer macOS).

## R5. FaceTime call lifecycle — Partial

1. WHEN triggered THE SYSTEM SHALL launch FaceTime, dial `SELF_NUMBER`, and click the Call confirmation.
2. WHEN the call is placed THE SYSTEM SHALL route FaceTime output to BlackHole 2ch so the backend hears the caller.
3. WHEN the camera preview starts THE SYSTEM SHALL turn the Mac's camera off.
4. **Todo:** WHEN the call connects THE SYSTEM SHALL start sharing the entire screen. *(README describes this; today only the agent prompt knows how — nothing triggers it.)*
5. WHEN the call ends THE SYSTEM SHALL stop listening and return to Idle.
6. WHEN any step fails THE SYSTEM SHALL emit `call failed: …` and text the reason to the user.

## R6. Voice commands on the call — Done

1. WHILE on a call THE SYSTEM SHALL stream caller audio from BlackHole 2ch to the OpenAI Realtime model and transcribe it.
2. WHEN an utterance is addressed to "Phantom" (including common mis-hearings) and asks for something THE SYSTEM SHALL call `run_task` with a complete task description.
3. WHEN the user asks to stop THE SYSTEM SHALL call `stop_task`.
4. WHEN speech is just conversation THE SYSTEM SHALL do nothing.
5. WHEN a voice task starts THE SYSTEM SHALL text `🤖 on it: <task>`.
6. **In progress:** WHEN Phantom replies on a call THE SYSTEM SHALL speak the reply to the caller with ElevenLabs TTS through BlackHole 16ch. *(Code in place — `speak.py` — needs `ELEVENLABS_API_KEY`.)*

## R7. Setup and permissions — Partial

1. THE SYSTEM SHALL run with `uv run uvicorn main:app` (backend) and `pnpm start` (frontend).
2. THE SYSTEM SHALL fail fast with a clear message if `OPENAI_API_KEY` is missing.
3. Docs SHALL list every macOS permission needed: Accessibility, Screen Recording, Microphone, Full Disk Access, and the BlackHole 2ch / 16ch devices.
4. **Todo:** `pnpm install` SHALL succeed on a clean Mac (currently fails on a lockfile policy error).
5. **Todo:** THE SYSTEM SHALL report missing permissions at startup (e.g. via `/health`) instead of failing mid-task.

## Non-functional requirements

- **N1 Platform:** macOS only (AppleScript, `open`, Control Center, chat.db). Primary display only.
- **N2 Latency:** batch predictable actions in one model turn; ~0.4 s settle after actions; screenshots sent as JPEG q60 at screen resolution.
- **N3 Safety:** the real OpenAI key never reaches the Electron app (`/voice/token` mints short-lived keys). **Todo:** the local API (`/task`, `/stop`, `/event`) has no auth and `CORS: *` — any local process or web page can start tasks. Restrict origin and add a shared token.
- **N4 Single user:** one task at a time; one status-stream client (see design §4).
- **N5 Config:** `OPENAI_API_KEY`, `SELF_NUMBER`, optional `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` in `backend/.env` (never committed).

## Out of scope (for now)

- Windows / Linux support, multi-monitor.
- Texting or calling anyone other than yourself.
- A web dashboard (the Electron island replaces it).
- Local speech-to-text / text-to-speech (OpenAI Realtime for listening, ElevenLabs for speaking).
