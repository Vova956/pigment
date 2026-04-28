# Pigment — Release Notes

## v0.0.1 — Initial Release (2026-04-28)

This is the first public release of Pigment, a real-time collaborative drawing canvas. The application is delivered as a **web app** hosted at <http://sdd3.cs.rpi.edu:3000> — no installation is required for end users.

### Highlights

- Real-time multi-user drawing over WebSockets (live cursors, stroke fan-out, presence list).
- Account system with email + password authentication (JWT, 7-day token).
- Persistent session state — strokes, text, and images are saved on the server and replayed when anyone re-joins.
- Toolset: pen, highlighter, eraser, lasso select, text, pan, image upload, undo, clear, export to PNG.
- Color palette plus a custom color picker that remembers your most recently used colors.
- Layers panel, live activity feed, and in-session chat alongside the canvas.
- Shareable session URLs (6-character session codes drawn from an unambiguous alphabet — no `O`, `0`, `1`, or `I`).
- Works on any modern browser (Chrome, Firefox, Edge, Safari) on desktop or mobile.

### Known limitations of this release

The following are intentional limitations of v0.0.1 and are tracked for future releases. None of them block the intended core workflow (sign in → start session → draw together).

- **No "redo".** Undo is supported but redo is not yet implemented; an undone action cannot be brought back without redoing it manually.
- **Undo of text and image insertions is local-only.** Undoing a stroke, erase, move, or clear is broadcast to all collaborators, but undoing a text label or image insertion currently only removes it from your own view; other users will continue to see it until they refresh.
- **No password reset.** If you forget your password there is currently no self-service flow to recover it. Create a new account with a different email.
- **No account deletion or profile editing UI.** Accounts persist until removed manually from the server database.
- **HTTP only.** The deployment runs on plain HTTP and uses an unencrypted `ws://` WebSocket connection. Do not use the deployed instance for sensitive content. TLS will be added in a future release.
- **Single server, single database.** State lives in a single SQLite file (`server/pigment.db`). The deployment is not horizontally scalable in this release.
- **No per-session permissions.** Anyone with an account who has the session link can join and edit. There are no read-only viewers, kicks, bans, or owner-only actions yet.
- **Image uploads are inlined into session state.** Uploaded images are embedded into the session state rather than stored as separate assets, so very large images grow the session payload and can slow down late joiners.
- **No mobile-optimized toolbar layout.** The canvas works on touch devices, but the toolbar is laid out for desktop widths and may wrap awkwardly on narrow phones in portrait orientation.

### Installation / access

Pigment is a web app. To use it, open <http://sdd3.cs.rpi.edu:3000> in any modern browser and sign up — there is nothing to install.

For developer setup and production deployment instructions, see [README.md](README.md).
