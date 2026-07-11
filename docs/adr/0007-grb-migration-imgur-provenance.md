# GRB migration: imgur's web endpoint is the provenance source for record dates

The GRB migration importer resolves the sheet's proof links (95.6% are `imgur.com/a/…` album links) through imgur's **undocumented web-client endpoint** — `api.imgur.com/post/v1/albums/<id>` with the public client-id imgur's own site ships in its JS bundle — and uses each album's `created_at` as the migrated record's `submittedAt` **and** `verifiedAt`. Those backdated timestamps land permanently in `records`: they become every historical record's official Record date.

**Why:** the official Imgur API is unobtainable — app registration (`api.imgur.com/oauth2/addclient`) has been dead since at least 2026-07, redirecting to the homepage. The web endpoint returns exact per-image upload timestamps and all album media anonymously, and the Discord mods effectively approved each record around its proof's upload time, so upload time is the best available approximation of historical verification. Without backdating, 1,100+ historical records would all read as dated import-day 2026.

**Trust basis (empirically verified 2026-07-11):** `created_at` agreed with the independent `i.imgur.com` `Last-Modified` header to within one second on era-known samples, and the Resolve stage cross-checks every row's upload date against its claimed patch's release window — contradictions are flagged, not imported.

**Considered and rejected:** the official Imgur API (registration dead); `Last-Modified`-only backdating (kept as a validation signal — it can't enumerate album contents); page-scraping album HTML (the pages are JS shells; only `og:image` survives, first image only, no dates).

**Consequences:** the endpoint is undocumented and can vanish — which is why the importer snapshots everything it returns into committed artifacts (`data/migration/grb/`) and mirrors the images to R2 in the same pass; after migration day nothing depends on imgur remaining alive or consistent. Dead albums degrade as already decided: `submittedAt` = sheet-import date, `verifiedAt` = null (rendered as "migrated"), missing proof flagged for a moderator.
