# phntm

Control your Mac over FaceTime + iMessage.

## Run

Backend (needs `backend/.env` with `OPENAI_API_KEY`):

```
cd backend && uv run uvicorn main:app --reload
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

## Voice + floating bar

The app is a small always-on-top bar (Cmd+Shift+Space brings it forward). Click the mic to talk; it uses the OpenAI Realtime API and calls the backend when you ask for something. Type into the bar if you prefer.

The bar is hidden from screenshots, so the agent never sees or clicks it.

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
