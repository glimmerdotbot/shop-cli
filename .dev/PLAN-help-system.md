# Help System Plan (100% command coverage)

This plan tracks the schema-driven help system that powers `shop --help`, resource help, and verb help.

## Scope / definition of done

- Every routed resource in `src/cli/router.ts` appears in `src/cli/help/registry.ts`.
- Every verb in each routed `src/cli/verbs/*.ts` has a `VerbSpec` (including multi-word verbs).
- Each verb entry includes operation name, input arg (if any), required flags, optional flags, examples, and notes.
- CRUD verbs include standard input flags; list/get verbs include selection + pagination flags where applicable.
- Help renders for top-level, resource-level, and verb-level without running handlers.
- Coverage can be verified against the checklist below.

## Phase 1 (completed)

- Added a command registry for all currently implemented resources and verbs.
- Added help rendering for top-level, resource-level, and verb-level help.
- Added schema extraction to surface input fields and enum values for `--set` help.
- Integrated help rendering into `src/cli.ts` so help never runs command handlers.

## Phase 2 (100% coverage for all routed commands)

- Expand the registry to cover every resource + verb listed below.
- Ensure each verb has: operation name, input arg, required flags, custom flags, and >= 1 example.
- Add notes for multi-step workflows (publish/unpublish, media uploads, bulk ops, etc.).
- Validate help output for each resource and a sample verb per resource.

### Coverage checklist (routed resources)

Core + product workflows:

- products: create, get, list, update, delete, duplicate, set-status, add-tags, remove-tags, publish, unpublish, publish-all, "metafields upsert", "media add", "media upload", bundle-create, bundle-update
- product-variants: upsert, get, get-by-identifier, list, count, bulk-create, bulk-update, bulk-delete, bulk-reorder, append-media, detach-media, join-selling-plans, leave-selling-plans, update-relationships
- collections: create, get, list, update, delete, duplicate
- customers: create, get, list, update, delete
- orders: create, get, list, update, delete
- order-edit: begin, get, commit, add-variant, add-custom-item, set-quantity, add-discount, remove-discount, update-discount, add-shipping, remove-shipping, update-shipping
- inventory: set, adjust
- files: upload
- publications: resolve, create, get, list, update, delete

Content + navigation:

- articles: create, get, list, update, delete
- blogs: create, get, list, update, delete
- pages: create, get, list, update, delete
- comments: get, list, delete
- menus: create, get, list, update, delete

Merchandising:

- catalogs: create, get, list, update, delete
- markets: create, get, list, update, delete

Draft orders:

- draft-orders: create, get, list, update, delete, duplicate, count, calculate, complete, create-from-order, preview-invoice, send-invoice, bulk-add-tags, bulk-remove-tags, bulk-delete, saved-searches, tags, delivery-options

Redirects + segments:

- url-redirects: create, get, list, update, delete
- segments: create, get, list, update, delete

Webhooks + meta:

- webhooks: create, get, list, update, delete
- metafield-definitions: create, get, list, update, delete
- metaobjects: create, get, list, update, delete
- metaobject-definitions: create, get, list, update, delete
- selling-plan-groups: create, get, list, update, delete, add-variants, remove-variants

B2B + enterprise:

- companies: create, get, list, count, update, delete, bulk-delete, assign-main-contact, revoke-main-contact, assign-customer
- company-contacts: create, get, update, delete, bulk-delete, assign-role, assign-roles, revoke-role, revoke-roles, remove-from-company, send-welcome-email
- company-locations: create, get, list, update, delete, bulk-delete, assign-address, assign-roles, revoke-roles, assign-staff, remove-staff, assign-tax-exemptions, revoke-tax-exemptions, create-tax-registration, revoke-tax-registration, update-tax-settings
- store-credit: get, credit, debit
- delegate-tokens: create, destroy

Storefront + checkout:

- themes: create, get, list, update, delete, duplicate, publish, files-upsert, files-delete, files-copy
- cart-transforms: create, list, delete
- validations: create, get, list, update, delete
- checkout-branding: get, upsert
- delivery-profiles: create, get, list, update, delete
- delivery-customizations: create, get, list, update, delete, activate

Analytics + marketing:

- web-pixels: create, get, update, delete
- server-pixels: get, create, delete, update-pubsub, update-eventbridge
- marketing-activities: create, create-external, get, list, update, update-external, upsert-external, delete-external, delete-all-external, create-engagement, delete-engagements

Operations + admin:

- bulk-operations: run-query, run-mutation, get, list, current, cancel
- inventory-items: get, list, update
- inventory-shipments: create, create-in-transit, get, delete, add-items, remove-items, update-quantities, mark-in-transit, receive, set-tracking
- carrier-services: create, get, list, list-available, update, delete
- saved-searches: create, update, delete, list-products, list-orders, list-customers, list-draft-orders, list-collections
- script-tags: create, get, list, update, delete

Returns + fulfillment:

- returns: create, get, calculate, cancel, close, reopen, process, refund, request, approve-request, decline-request, remove-item, reason-definitions, returnable-fulfillments
- fulfillment-orders: get, list, accept-request, reject-request, submit-request, accept-cancellation, reject-cancellation, submit-cancellation, cancel, close, open, hold, release-hold, reschedule, move, split, merge, report-progress, mark-prepared, set-deadline, reroute
- fulfillments: create, get, cancel, update-tracking, create-event

Subscriptions:

- subscription-contracts: create, atomic-create, get, list, update, activate, pause, cancel, expire, fail, set-next-billing, change-product
- subscription-billing: get-attempt, list-attempts, create-attempt, get-cycle, list-cycles, charge, bulk-charge, bulk-search, skip-cycle, unskip-cycle, edit-schedule, edit-cycle, delete-edits
- subscription-drafts: get, commit, update, add-line, update-line, remove-line, add-discount, update-discount, remove-discount, apply-code, add-free-shipping, update-free-shipping

Platform + config:

- app-billing: create-one-time, create-subscription, cancel-subscription, update-line-item, extend-trial, create-usage-record, get-installation, list-subscriptions
- config: get, update-policy, enable-locale, disable-locale, update-locale, get-locales
- translations: get, list, list-by-ids, register, remove
- events: get, list, count
- functions: get, list

### Unrouted verb files (decide)

These verb files exist but are not currently routed in `src/cli/router.ts`. Decide whether to route them (and then add help coverage) or remove/archive.

- discounts-automatic: get, list, create-basic, create-bxgy, create-free-shipping, create-app, update-basic, update-bxgy, update-free-shipping, update-app, delete, bulk-delete, activate, deactivate
- discounts-code: get, get-by-code, list, count, create-basic, create-bxgy, create-free-shipping, create-app, update-basic, update-bxgy, update-free-shipping, update-app, delete, bulk-delete, activate, deactivate, bulk-activate, bulk-deactivate, add-redeem-codes, delete-redeem-codes
- fulfillment-services: get, list, create, update, delete
- gift-cards: get, list, count, config, create, update, credit, debit, deactivate, notify-customer, notify-recipient
- inventory-transfers: get, list, create, create-ready, edit, duplicate, mark-ready, cancel, set-items, remove-items, delete
- locations: get, list, count, add, edit, delete, activate, deactivate, enable-local-pickup, disable-local-pickup
- payment-terms: templates, create, update, delete, send-reminder
- price-lists: get, list, create, update, delete, add-prices, update-prices, update-prices-by-product, delete-prices, add-quantity-rules, delete-quantity-rules, update-quantity-pricing
- refunds: get, calculate, create

## Phase 3 (guardrails)

- Add a coverage check that compares:
  - routed resources in `src/cli/router.ts`
  - verbs used in each routed `src/cli/verbs/*.ts`
  - help registry entries in `src/cli/help/registry.ts`
- Fail CI when any resource/verb is missing or when help references unknown commands.
- Optionally generate registry stubs for new resources from the verb list.
