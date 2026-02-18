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

Focus next on the remaining operations/resources from `.dev/operations.md` that still aren’t implemented (e.g. carrier-services, cart-transforms, customer-addresses, delivery-profiles, gift-cards, payment-terms, price-lists, web-pixels, web-presences, subscriptions).

### Tranche 4 implemented (2026-02-18)

Content:

- `shop articles create|get|list|update|delete`
- `shop blogs create|get|list|update|delete`
- `shop pages create|get|list|update|delete`
- `shop comments get|list|delete`

Merch/structure:

- `shop menus create|get|list|update|delete`
- `shop publications create|get|list|update|delete`
- `shop catalogs create|get|list|update|delete`
- `shop markets create|get|list|update|delete`

Draft orders:

- `shop draft-orders create|get|list|update|delete|duplicate|count`
- `shop draft-orders calculate|complete`
- `shop draft-orders create-from-order --order-id <gid|num>`
- `shop draft-orders preview-invoice|send-invoice --id <gid|num> [--input <EmailInput>]`
- `shop draft-orders bulk-add-tags|bulk-remove-tags --ids <gid|num,...> --tags a,b`
- `shop draft-orders bulk-delete --ids <gid|num,...> --yes`
- `shop draft-orders saved-searches`
- `shop draft-orders tags --id <gid>` (DraftOrderTag ID)
- `shop draft-orders delivery-options --input <DraftOrderAvailableDeliveryOptionsInput>`

Redirects + segments:

- `shop url-redirects create|get|list|update|delete`
- `shop segments create|get|list|update|delete`

Webhooks:

- `shop webhooks create --topic <WebhookSubscriptionTopic> --input <WebhookSubscriptionInput>`
- `shop webhooks get|list|update|delete`

Meta:

- `shop metafield-definitions create|get|list|update|delete`
  - Note: `list` requires `--owner-type` (e.g. `PRODUCT`).
  - Note: `update` is identifier-based (key/namespace/ownerType); `--id` works by resolving identifier first.
- `shop metaobjects create|get|list|update|delete` (list requires `--type`)
- `shop metaobject-definitions create|get|list|update|delete`

Selling plans:

- `shop selling-plan-groups create|get|list|update|delete`
- `shop selling-plan-groups add-variants|remove-variants --id <gid|num> --variant-ids <gid|num,...>`
