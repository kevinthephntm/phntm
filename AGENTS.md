# PHNTM

- Desktop app: Electron Forge, React, TypeScript and plain CSS in `frontend/`.
- Keep the product a bottom-centred island. The browser view is an explicitly simulated interface preview, not a remote-control dashboard.
- Install with `pnpm install` in `frontend/`. `pnpm start` starts Electron and the webpack renderer at `http://localhost:3000/main_window/`. Forge's startup check runs `pnpm --version`, so pnpm 11.21.0 must be on PATH.
- UI copy is lowercase and lightly gen-z. `.island-wrap` sets `text-transform: lowercase` so backend and agent text match; the task textarea keeps its case.
- Backend (only when Liam asks for end-to-end runs): `uv sync --locked`, then `uv run uvicorn main:app --reload --timeout-graceful-shutdown 2` in `backend/`. macOS permissions attach to the app that launched it (Devin.app from a Devin shell). Full Disk Access has no prompt and must be added in System Settings.
- Verify frontend changes with `pnpm typecheck`, `pnpm exec oxlint`, `pnpm exec oxfmt --check src`, and `node --test src/state.test.mjs` (Node 22.18+).
- Browser preview never connects to the backend. Use its state selector to check calls, captions, errors and offline behavior without controlling the Mac.
- Do not start the backend for UI checks: startup watches iMessage and can initiate real computer actions.
- Devin Desktop shells can inherit `ELECTRON_RUN_AS_NODE`; unset it for native launches (`env -u ELECTRON_RUN_AS_NODE pnpm start`).
- Backend events are defined in `docs/design.md`. Keep status and call state separate; ending a call must not hide a running task.
- Never read dotenv values or commit credentials.
