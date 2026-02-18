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
- `shop products media add --id <gid|num> --url <https://...>` (repeatable `--url`)
- `shop products media upload --id <gid|num> --file <path>` (repeatable `--file`)
- `shop inventory set --inventory-item-id <gid|num> --location-id <gid|num> --available <int>`
- `shop inventory adjust --inventory-item-id <gid|num> --location-id <gid|num> --delta <int>`
- `shop files upload --file <path>` (repeatable `--file`)
- `shop publications resolve --publication <name|gid|num>`
- `shop products publish --id <gid|num> --publication-id <gid|num> [--publication <name>] [--at <iso>|--now]`
- `shop products unpublish --id <gid|num> --publication-id <gid|num> [--publication <name>]`
- `shop products publish-all --id <gid|num> [--at <iso>|--now]`
- `shop products metafields upsert --id <gid|num> --input <json|@file>` (or `--set/--set-json`)
- `shop product-variants upsert --product-id <gid|num> --input <json|@file>` (or `--set/--set-json`)

Common flags (implemented subset):

- `--input <json>` / `--input @file.json`
- `--set path=value` (repeatable)
- `--set-json path=<json|@file.json>` (repeatable)
- `--id <gid|num>` (numeric IDs are coerced to `gid://shopify/<Type>/<id>` when type is implied)
- `--query`, `--first`, `--after`, `--sort`, `--reverse` (list)
- `--format json|table|raw`, `--quiet`
- `--view summary|ids|full|raw` (default: `summary`)
- `--select <path>` (repeatable; **dot paths**; e.g. `variants.nodes.id`)
  - when selecting `*.nodes.*` / `*.edges.*`, a default cap is applied (`first: 10`) and `pageInfo { hasNextPage endCursor }` is added
- `--selection <graphql>` (selection override; can be `@file.gql`)
- `--dry-run` (prints GraphQL operation + variables)
- `--dry-run` does not require valid auth (no request is sent)
- `--no-fail-on-user-errors`
- `--help` / `-h` at resource/verb level (does not require auth)

Known gaps vs notes (next to implement):

- Remaining workflows from `.dev/workflows.md` (beyond product/inventory/media/files)
- Remaining operations/resources from `.dev/operations.md`

## Next tranche proposal

High-leverage workflows from `.dev/workflows.md` (Score 5/4):

1. Expand Tier 2/3 CRUD resources from `.dev/operations.md`
