# Proof backup runbook (R2)

Proof images are the only bytes we cannot recreate: verified proofs live in the
`wt-records-proofs` bucket, pending ones in `wt-records-proofs-pending`.
`wt-records-assets` is **excluded** — catalog imagery is re-mirrorable from its
upstream source, so backing it up buys nothing.

The corpus is ~1–2 GB, so a full copy is cheap; there is no need for anything
smarter than a periodic append-only copy.

## What you need

- The `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` values from
  `.env` (or Railway → web service → Variables).
- [rclone](https://rclone.org/) — any install works; with Docker use
  `docker run --rm -v "$PWD:/data" --env-file <envfile> rclone/rclone …`.

## Back up

rclone remotes can be defined entirely through environment variables, so no
config file (and no secrets on disk) are needed:

```sh
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

rclone copy R2:wt-records-proofs         ./r2-backup/wt-records-proofs
rclone copy R2:wt-records-proofs-pending ./r2-backup/wt-records-proofs-pending
```

`copy` (not `sync`) so bucket-side deletions never propagate: if the bucket is
ever emptied by mistake, a backup run afterwards must not erase the only copy.

Then verify the backup contains everything the bucket does (checks size + hash,
transfers nothing; extra backup-only files are expected and fine):

```sh
rclone check --one-way R2:wt-records-proofs         ./r2-backup/wt-records-proofs
rclone check --one-way R2:wt-records-proofs-pending ./r2-backup/wt-records-proofs-pending
```

Keep the `r2-backup/` directory anywhere durable that is not Cloudflare (local
disk that gets its own backup, external drive, another provider's free tier).

## Cadence

Monthly, plus immediately before anything that touches storage credentials or
bucket configuration. Proofs are written rarely (a handful per week at most),
so a monthly copy bounds the loss window at a few objects.

## Restore

Use `rclone copy`, **never `sync`**, toward the bucket: the backup is older
than the bucket, and `sync` would delete every proof uploaded since it was
taken. `copy` only fills in what is missing or differs. Restore only the
bucket that was damaged:

```sh
rclone copy ./r2-backup/wt-records-proofs         R2:wt-records-proofs
rclone copy ./r2-backup/wt-records-proofs-pending R2:wt-records-proofs-pending
```

`record_proof.storage_path` values are opaque object keys, so a restored bucket
is immediately consistent with the database — nothing else to fix up. Spot-check
one verified proof URL (`https://proofs.wtrecords.gg/<storage_path>`) and run
`bun run r2:verify` afterwards.
