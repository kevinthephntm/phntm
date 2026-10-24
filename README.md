# phntm

Control your Mac over FaceTime + iMessage.

## Run

Backend (needs `backend/.env` with `OPENAI_API_KEY`):

```
cd backend && uv run uvicorn main:app --reload --timeout-graceful-shutdown 2
```

Frontend:

```
cd frontend && pnpm install && pnpm start
```

Type a task in the window, hit Run. The agent screenshots your Mac, asks OpenAI what to do, and clicks/types for you.

macOS will ask for Accessibility and Screen Recording permission for your terminal the first time. Grant both.

## iMessage trigger

Text yourself `ft me` and the Mac FaceTimes your phone. Needs:

- `SELF_NUMBER=+1...` in `backend/.env` (your phone number, the one the Mac should call).
- Full Disk Access for your terminal (System Settings → Privacy & Security → Full Disk Access), so the backend can read `~/Library/Messages/chat.db`. Restart the backend after granting.
- Messages in iCloud on, so texts from your phone show up on the Mac.

## The island

The app is a small always-on-top pill at the bottom centre of the screen. It shows one state at a time (Idle, Calling, Listening, Thinking, Working · step N, Done, Error) and grows into a card with a large caption whenever it hears you on a call, then shrinks back. Designed to be read from your phone through the shared screen.

Cmd+Shift+Space focuses it and reveals a text box to type a task at the desk. Enter runs, Esc stops.

The screen edges glow with the same state: white while listening, red while working, amber while calling, green when done. The glow is a click-through window, it never takes focus.

### Talking over FaceTime (BlackHole)

Install two virtual audio devices, then switch the bar to "FaceTime" mode:

```
brew install blackhole-2ch blackhole-16ch
```

Then in FaceTime's menu bar → Video:
- Output: **BlackHole 2ch** (your voice from the phone goes to the agent)
- Microphone: **BlackHole 16ch** (the agent's voice goes to your phone)

If FaceTime has no Output option, set the system output to a Multi-Output device (Audio MIDI Setup → + → Multi-Output Device, tick BlackHole 2ch and your speakers).

When you text `ft me`, the bar switches to FaceTime mode by itself once the call is placed.

## Full remote flow (what `ft me` does now)

1. You text yourself `ft me`. The Mac FaceTimes your phone and clicks Call.
2. When you pick up, it routes the call audio to BlackHole 2ch, turns on screen sharing from the menu-bar video controls, and starts listening.
3. Say **"Phantom, …"** followed by what you want. Only sentences with the name are acted on; everything else is ignored. You get a "🤖 on it" text, then watch the shared screen.
4. Any other text you send yourself is also run as a task.

Needs for the terminal that runs the backend: Full Disk Access, Accessibility, Microphone, Screen Recording.
