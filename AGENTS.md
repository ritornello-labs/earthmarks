# Earthmarks agent instructions

Earthmarks is a general-purpose name-to-location Anki globe deck.

- Preserve the original flat-map exercise as a separate task; this repo owns the globe.
- Keep all live collection snapshots, IDs, scheduling, raw responses and recovery files outside Git.
- Public fixtures must be synthetic; capture card screenshots from actual disposable Anki with anki-addon-workbench, never a browser reconstruction.
- Require Name and Coordinates only when adding a place; share the offline world imagery across all notes.
- Default country borders off. Keep the answer interactive, retaining guess, target, arc and distance.
- AnkiDroid setup instructions must explain Settings → Advanced → localStorage in study screen for lasting preferences; enabled-option persistence remains unverified.
- Read docs/RELEASING.md before publication. Use the shared immutable publication checker and installed hooks, plus quiet required CI.
- Keep new media under review until visually approved; no public AnkiWeb listing before explicit approval.
- Never run a local Android emulator; use the remote QA service when needed and stop the worker afterward.
- Use sfw for public-registry package installs; retain the seven-day dependency age gate and lockfile.
- Sign commits with GPG and push reviewed work regularly.
