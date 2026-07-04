# design-sync notes — wt-records

- App repo, not a packaged library: the converter runs in synth-entry mode. `cfg.entry` deliberately points at nonexistent `./dist/index.js` — soft-miss routes to synthesis from `cfg.srcDir` (src/components) while fixing the package-dir walk to the repo root. Do not "fix" the entry path.
- `buildCmd` compiles Tailwind 4 (`src/styles.css` → `.design-sync/.cache/compiled.css`). Re-run it BEFORE `package-build.mjs` whenever authored previews add utility classes — Tailwind v4 auto-scans `.design-sync/previews/`, so preview-only classes only exist after a recompile.
- The emitted card harness hardcodes a white body; the DS defaults to the Night Hangar theme, so bare cells render invisible (near-white ink on white). Every authored preview wraps its cells in the Hall wrapper: `<div className="rounded-[26px] bg-base p-8 text-fg">…</div>`. Rendered designs are unaffected (styles.css's own `@layer base` body rule applies there).
- Previews import from `'wt-records'` (aliased at compile time). The repo's tsconfig can't resolve it — `.design-sync/` must stay excluded from repo tsc/eslint/prettier.
- All 14 `dtsPropsFor` bodies are hand-written in config (synth-entry extraction yields `[key: string]: unknown` stubs). Update them when a component's props change.
- Fonts: the shipped CSS names 'SF Pro Text' / Inter as system-stack preferences; the app ships no font files either, so system-font substitutes in the DS pane are faithful. ([FONT_MISSING] is expected.)
- Playwright: cached chromium build 1200 pairs with playwright 1.57.0 (installed in `.ds-sync/`).
- Theme mechanics for consumers: Night is `:root` default; Daylight Hall activates via `data-theme="light"` on the root `<html>` element (documented in conventions.md).

- `preview-rebuild.mjs` hard-exits `[CONFIG_STALE]` per-target when a component's `cfg.overrides` entry postdates the stamped full build — bisect `--components` to let healthy siblings proceed; only a full `package-build.mjs` re-stamps. Sequence config-override edits BEFORE parallel preview waves.
- Preview composition: keep card content width ≤ ~44rem (wider clips at the capture card edge — put the width on the Hall). Inline-fragment components (LatestRecord) need their app harness (the `text-sm text-fg-muted` paragraph + bold "Latest — " lead-in) or they read as orphaned fragments. RecordName's plain state: pass snapshots EQUAL to displayName (exercises the collapse branch), not nulls.
- Grepping compiled.css for arbitrary-value utilities needs escaped brackets (`\.rounded-\[26px\]`) or you get false misses.
- `.design-sync/safelist.txt` widens the compiled Tailwind vocabulary for pages composed in Claude Design (Tailwind v4 scans it). Extend it rather than letting the design agent invent unshipped classes.

## Known render warns

- `[FONT_MISSING]` "SF Pro Text", "Inter" — deliberate system-stack references, nothing to ship.
- CountUp-bearing cells (RecordMonument, CountUp) screenshot mid-tally: the number animates 0→value over 800ms on mount and captures catch a late frame (e.g. 41 of 42). Settles correctly live.

## Re-sync risks

- `compiled.css` is generated, gitignored state: a fresh clone must run `buildCmd` before the converter or `cssEntry` dangles ([CSS_IMPORT_MISSING]).
- Component props and the hand-written `dtsPropsFor` can drift silently — the converter can't check them; eyeball when touching component APIs.
- Preview realism is tied to current UI composition (glass-mid/glass-thick wrappers); if the material classes get renamed in styles.css, previews keep compiling but render stale looks.
