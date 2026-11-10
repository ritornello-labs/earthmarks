# Release and media checklist

## Public source

- Keep fresh public history separate from internal collection work.
- Never commit live Anki exports, identities, scheduling, review logs, recovery
  archives, raw reports, secrets, generated APKGs or intermediate media trees.
- Use the immutable publication gate pinned in `.github/workflows/publication-check.yml`.
  Install its matching frozen local hooks before pushing. Preserve existing hooks.
- Require quiet hosted publication checks on the default branch. Recheck coverage
  before any visibility change or artifact upload.

## User-facing setup

The AnkiWeb listing and included instructions must contain:

> **AnkiDroid:** To keep your Earthmarks preferences between study sessions,
> enable **Settings → Advanced → localStorage in study screen**.
> Without it, the globe still works, but preferences may reset when you leave
> the study screen.

The documented switch is the working assumption. An enabled-switch persistence
retest remains unverified; do not describe the earlier configuration's reset as
proof that the enabled feature is broken. Explain client-specific persistence
limits and the shared overview imagery's resolution accurately.

## Public media

1. Use a synthetic, meaningful place/guess example in disposable Anki.
2. Seed the current `out/places/preview.apkg` from the current source build.
3. Use anki-addon-workbench with `anki-media-workbench.toml` and
   `EARTHMARKS_CAPTURE_DIR` pointing outside Git to capture native front/reveal
   frames for the camera/reveal and settings/borders scenes, with monotonic frame
   timestamps. Save its result privately. The generic config may be copied to a
   temporary directory as `anki-workbench.toml` for the CLI.
4. Inspect text, markers, arc, framing, distance, controls and visible attribution.
   Crop only to present the native card; never recreate it in HTML for a screenshot.
5. Review the exact proposed AnkiWeb listing and images with Elvis before upload.
   His approval must precede the AnkiWeb submission.

## Deck release

The first edition is the 704-city seed in `places/data/places.json`. Personal
collection mirrors and source scheduling are outside this release scope. This
repository's synthetic `--apkg` build is a QA fixture, not the shared deck.

The Ritornello entry and both final GIFs were approved on November 9, 2026;
exact media hashes are in `release/ritornello-approval.json`. The separate
AnkiWeb draft is `release/ankiweb.md` and its complete preview was approved on November 9, 2026.
Prepare the final release package through anki-addon-release
and isolated Publisher.
Check copyright/provenance and the exact final APKG; archive byte-identical
AnkiWeb submission bytes in a tagged GitHub release. Include the download and
AnkiWeb links in Ritornello only when they exist. A public repository does not
itself authorize an Earthmarks deck submission.

Android QA uses the remote service only; never start a local emulator on the
storage-constrained development machine. Stop every leased worker when done.

Build the clean public seed with `python places/scripts/release.py --output out/places/Earthmarks.apkg`.
Supply the 341 overview tiles with `--media PATH` if they are not under
`out/places/media`. This build has stable public identities and only new cards;
never substitute the three-note `build.py --apkg` QA fixture.
Release configuration is `release/ankiweb.toml`; source deck IDs belong in ignored `.env`.
