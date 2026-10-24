# phntm — Tasks

Checklist of what's built and what's next. Each task links to a requirement in [requirements.md](requirements.md) and the relevant section of [design.md](design.md).

Legend: `[x]` done · `[ ]` todo · **P0** blocks the core remote flow · **P1** important · **P2** nice to have.

## Done

- [x] Split repo into `backend/` (FastAPI, uv) and `frontend/` (Electron Forge, React) — R7.1
- [x] Computer-use agent loop with `open_app` / `open_url` tools, stop and takeover — R1
- [x] Speed up the agent loop (batched actions, JPEG screenshots, shorter settles) — N2
- [x] iMessage send helper — R4.3
- [x] iMessage watcher on `chat.db` with `ft me` keyword and task-by-text — R4
- [x] FaceTime call lifecycle: dial, confirm, detect connected / in-call, route audio to BlackHole 2ch, camera off — R5.1–5.3, R5.5–5.6
- [x] Listen to the caller from the backend via Realtime; `run_task` / `stop_task` — R6.1–6.5
- [x] Edge glow window — R2.5
- [x] Bottom-centre island with phase state machine and readable steps — R2.1–2.4, R3
- [x] README for the island and remote flow — R7.3
- [x] Agent voice back to the caller: `speak.py` plays ElevenLabs TTS into BlackHole 16ch when Phantom replies — R6.6 (needs `ELEVENLABS_API_KEY` to run)

## P0 — make the remote flow match the README

- [ ] **Start screen sharing when the call connects** — R5.4
  - After `facetime.wait_connected()` in `watcher.start_call`, share the entire screen. Either a deterministic AppleScript/pyautogui routine in `facetime.py` (like `camera_off`) or a fixed agent task using the existing prompt instructions.
  - Emit `status: sharing screen` / `could not share screen: …`.
  - Done when: texting `ft me` and picking up shows the Mac screen on the phone with no manual steps.
- [ ] **Fix `pnpm install` lockfile policy error on a clean Mac** — R7.4
  - Reproduce, then fix `pnpm-workspace.yaml` / lockfile or pin the pnpm version in `devEngines`.
  - Done when: `pnpm install && pnpm typecheck && pnpm lint` pass from a fresh clone.

## P1 — reliability and safety

- [ ] **Live caption card for `heard` events** — R2.6
  - Handle `heard` in the `App.tsx` reducer: store the transcript + timestamp, render a larger card with big text, collapse after a few seconds. `ResizeObserver` already grows the window.
- [ ] **Lock down the local API** — N3
  - Restrict CORS to the Electron origin; require a shared token header on `/task`, `/stop`, `/event` (token generated at backend start and passed to Electron, or read from `.env`).
- [ ] **Review auto-acknowledged safety checks** — N3
  - `agent.py` acknowledges every `pending_safety_checks` item. At minimum emit them as events; optionally pause and ask via iMessage.
- [ ] **Broadcast events to every SSE client** — design §5, N4
  - Replace the single `queue.Queue` with per-subscriber queues so a second client doesn't steal events.
- [ ] **Structured event protocol** (T-refactor-events) — design §2
  - Add an explicit `phase`/`code` field instead of matching text prefixes like `"calling"` or `"listening on the FaceTime call"` in the reducer. Keep `text` for display.
- [ ] **Permission check on startup** — R7.5
  - Extend `/health` to report Accessibility, Screen Recording, Full Disk Access, BlackHole devices present; show problems on the island.
- [ ] **Faster stop** — R1.7
  - Check `stop` between individual actions in a batch, not only between output items.

## P2 — polish and cleanup

- [ ] Barge-in for talk-back: cancel/pause ElevenLabs playback when the caller speaks over Phantom — R6.6
- [ ] Remove or use leftovers: `GET /voice/token`, `facetime` event type — design §9
- [ ] Tests: unit tests for `decode_body`, `agent.key`/`describe`, and the `App.tsx` reducer; a fake event stream for UI work without a real call.
- [ ] Fill in `pyproject.toml` / `package.json` descriptions; add a backend linter (ruff).
- [ ] Multi-monitor: place island/glow on the display being shared — N1
- [ ] Packaging: `pnpm make` a signed `.app` and a one-command start for both processes.
