# shopcli CLI progress

This repo is building a CLI that follows the conventions in `.dev/operations.md` and `.dev/workflows.md`.

## How to run

- Install deps: `npm ci`
- Run (dev): `npm run dev:shop -- <resource> <verb> [flags]`
- Or run via bin: `node bin/shop.js <resource> <verb> [flags]`

Auth defaults to env vars:

- `SHOPIFY_SHOP`
- `SHOPIFY_ACCESS_TOKEN`

Overrides:

- `--shop`
- `--access-token`
- `--api-version` (default: `2026-04`)

## Implemented (Phases 1-4)

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

Known gaps vs notes:

- Phase 4 complete: full coverage of `.dev/operations.md` and `.dev/phase-4-complete-coverage.md`

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

### Phase 4 implemented (2026-02-18)

B2B & enterprise:

- `shop companies create|get|list|count|update|delete|bulk-delete`
- `shop companies assign-main-contact|revoke-main-contact|assign-customer`
- `shop company-contacts create|get|update|delete|bulk-delete`
- `shop company-contacts assign-role|assign-roles|revoke-role|revoke-roles`
- `shop company-contacts remove-from-company|send-welcome-email`
- `shop company-locations create|get|list|update|delete|bulk-delete`
- `shop company-locations assign-address|assign-roles|revoke-roles`
- `shop company-locations assign-staff|remove-staff`
- `shop company-locations assign-tax-exemptions|revoke-tax-exemptions`
- `shop company-locations create-tax-registration|revoke-tax-registration|update-tax-settings`
- `shop store-credit get|credit|debit`
- `shop delegate-tokens create|destroy`

Storefront & checkout:

- `shop themes create|get|list|update|delete|duplicate|publish`
- `shop themes files-upsert|files-delete|files-copy`
- `shop cart-transforms create|list|delete`
- `shop validations create|get|list|update|delete`
- `shop checkout-branding get|upsert`
- `shop delivery-profiles create|get|list|update|delete`
- `shop delivery-customizations create|get|list|update|delete|activate`

Analytics & marketing:

- `shop web-pixels create|get|update|delete`
- `shop server-pixels get|create|delete|update-pubsub|update-eventbridge`
- `shop marketing-activities create|create-external|get|list|update|update-external|upsert-external`
- `shop marketing-activities delete-external|delete-all-external`
- `shop marketing-activities create-engagement|delete-engagements`

Operations & admin:

- `shop bulk-operations run-query|run-mutation|get|list|current|cancel`
- `shop inventory-items get|list|update`
- `shop inventory-shipments create|create-in-transit|get|delete`
- `shop inventory-shipments add-items|remove-items|update-quantities`
- `shop inventory-shipments mark-in-transit|receive|set-tracking`
- `shop carrier-services create|get|list|list-available|update|delete`
- `shop saved-searches create|update|delete`
- `shop saved-searches list-products|list-orders|list-customers|list-draft-orders|list-collections`
- `shop script-tags create|get|list|update|delete`

Products & extensions:

- `shop product-variants get|get-by-identifier|list|count`
- `shop product-variants bulk-create|bulk-update|bulk-delete|bulk-reorder`
- `shop product-variants append-media|detach-media`
- `shop product-variants join-selling-plans|leave-selling-plans`
- `shop product-variants update-relationships`
- `shop products bundle-create|bundle-update`

Platform & configuration:

- `shop app-billing create-one-time|create-subscription|cancel-subscription`
- `shop app-billing update-line-item|extend-trial|create-usage-record`
- `shop app-billing get-installation|list-subscriptions`
- `shop config get|update-policy|enable-locale|disable-locale|update-locale|get-locales`
- `shop translations get|list|list-by-ids|register|remove`
- `shop events get|list|count`
- `shop functions get|list`

### Phase 3 implemented (2026-02-18)

Returns:

- `shop returns create|get|calculate|cancel|close|reopen|process|refund`
- `shop returns request|approve-request|decline-request|remove-item`
- `shop returns reason-definitions|returnable-fulfillments`

Fulfillment orders + fulfillments:

- `shop fulfillment-orders get|list|accept-request|reject-request|submit-request`
- `shop fulfillment-orders accept-cancellation|reject-cancellation|submit-cancellation|cancel|close|open`
- `shop fulfillment-orders hold|release-hold|reschedule|move|split|merge|report-progress|mark-prepared`
- `shop fulfillment-orders set-deadline|reroute`
- `shop fulfillments create|get|cancel|update-tracking|create-event`

Subscriptions:

- `shop subscription-contracts get|list|create|atomic-create|update|activate|pause|cancel|expire|fail`
- `shop subscription-contracts set-next-billing|change-product`
- `shop subscription-billing get-attempt|list-attempts|create-attempt|get-cycle|list-cycles|charge`
- `shop subscription-billing bulk-charge|bulk-search|skip-cycle|unskip-cycle|edit-schedule|edit-cycle|delete-edits`
- `shop subscription-drafts get|commit|update|add-line|update-line|remove-line`
- `shop subscription-drafts add-discount|update-discount|remove-discount|apply-code`
- `shop subscription-drafts add-free-shipping|update-free-shipping`

Order edit:

- `shop order-edit begin|get|commit|add-variant|add-custom-item|set-quantity`
- `shop order-edit add-discount|remove-discount|update-discount`
- `shop order-edit add-shipping|remove-shipping|update-shipping`
