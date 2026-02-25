# AGENTS.md

## Cursor Cloud specific instructions

This is a frontend-only React + Three.js 3D game (IKEA Game Prototype). No backend, no database, no Docker.

### Prerequisites

- **Node.js v24.2.0** (specified in `.nvmrc`). The update script handles this via nvm.

### Key commands

All standard commands are in `package.json` scripts:

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (Vite, serves at `http://localhost:5173`) |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Preview build | `npm run preview` |

### Notes

- ESLint has ~68 pre-existing errors (mostly React Compiler / react-hooks lint rules and unused vars). These are not setup issues.
- TypeScript type checking (`npm run typecheck`) passes cleanly.
- The project has no automated test suite (no `test` script in `package.json`).
- The game uses WebGL via Three.js / React Three Fiber. Headless environments without GPU may render a blank canvas; use a real browser (Chrome) to verify rendering.
- Optional WebSocket integrations (external control + live level sync) are disabled by default and not needed for development.
