# shopcli CLI progress

This repo is building a CLI that follows the conventions in `.dev/operations.md` and `.dev/workflows.md`.

## How to run

- Install deps: `npm ci`
- Run (dev): `npm run dev:shop -- <resource> <verb> [flags]`
- Or run via bin: `node bin/shop.js <resource> <verb> [flags]`

Auth defaults to env vars:

- `SHOP_DOMAIN` (or `SHOPIFY_SHOP`)
- `SHOPIFY_ACCESS_TOKEN`

Overrides:

- `--shop-domain`
- `--access-token`
- `--api-version` (default: `2026-04`)

## Implemented (first ~25%)

Tier 1 (Core) CRUD-ish commands:

- `shop products create|get|list|update|delete|duplicate`
- `shop collections create|get|list|update|delete|duplicate`
- `shop customers create|get|list|update|delete`
- `shop orders create|get|list|update|delete`

Tier 1 workflows (partial):

- `shop products set-status --id <gid|num> --status ACTIVE|DRAFT|ARCHIVED`
- `shop products add-tags --id <gid|num> --tags tag,tag`
- `shop products remove-tags --id <gid|num> --tags tag,tag`

Common flags (implemented subset):

- `--input <json>` / `--input @file.json`
- `--set path=value` (repeatable)
- `--set-json path=<json|@file.json>` (repeatable)
- `--id <gid|num>` (numeric IDs are coerced to `gid://shopify/<Type>/<id>` when type is implied)
- `--query`, `--first`, `--after`, `--sort`, `--reverse` (list)
- `--format json|table|raw`, `--quiet`
- `--dry-run` (prints GraphQL operation + variables)
- `--dry-run` does not require valid auth (no request is sent)
- `--no-fail-on-user-errors`

Known gaps vs notes (next to implement):

- `--selection <graphql>` support
- `--select <path>` dot-path support (currently top-level fields only)
- More workflows: publish/unpublish, inventory set/adjust, metafields upsert, media add/upload, etc.
- Remaining operations/resources from `.dev/operations.md`

## Next tranche proposal

High-leverage workflows from `.dev/workflows.md` (Score 5/4):

1. `shop publications resolve`
2. `shop products publish` / `unpublish` / `publish-all`
3. `shop inventory set` / `adjust`
4. `shop products metafields upsert`
5. `shop products media add` (URL)
