# shop-cli

A command-line interface for the Shopify Admin GraphQL API.

## Installation

Run directly with npx:

```bash
npx shop-cli
```

Or install globally:

```bash
npm install -g shop-cli
```

Then run:

```bash
shop
```

## Usage

```
shop <resource> <verb> [flags]
```

### Help command name

The CLI’s help output (and pagination hints) uses the command that invoked it (`shop` or `shop-cli`). Override it with `SHOP_CLI_COMMAND`:

```bash
SHOP_CLI_COMMAND=shopcli shop --help
```

## Documentation

The CLI is self-documenting. Point your agent at it for context:

```bash
shop                     # High-level overview of all resources
shop --help              # Same as above

shop products            # Detailed docs for a specific resource
shop products --help     # Same as above
```

## Authentication

Authentication requires a Shopify access token and shop domain. These can be provided via environment variables or command-line flags.

### Environment Variables

```bash
export SHOPIFY_SHOP="your-shop.myshopify.com"
export SHOPIFY_ACCESS_TOKEN="shpat_xxxxx"
```

### Command-line Flags

Flags override environment variables:

```bash
shop products list --shop your-shop.myshopify.com --access-token shpat_xxxxx
```

### Custom GraphQL Endpoint

For proxies or custom endpoints:

```bash
shop products list --graphql-endpoint https://your-proxy.example.com/graphql
```

Or via environment variable:

```bash
export GRAPHQL_ENDPOINT="https://your-proxy.example.com/graphql"
```

### Custom Headers

Add request headers via repeatable `--header` flags:

```bash
shop products list --header X-Foo=bar --header "X-Bar: baz"
```

Or via environment variable (JSON object):

```bash
export SHOPIFY_HEADERS='{"X-Foo":"bar","X-Bar":"baz"}'
```

## Output Formats

Control output format with `--format`:

| Format     | Description                                              |
| ---------- | -------------------------------------------------------- |
| `json`     | Pretty-printed JSON (default)                            |
| `jsonl`    | JSON Lines - one JSON object per line, useful for piping |
| `table`    | Markdown table format                                    |
| `raw`      | Compact JSON without formatting                          |
| `markdown` | Structured markdown with headings                        |

Examples:

```bash
shop products list --first 5 --format table
shop products list --first 10 --format jsonl | jq '.title'
```

## Views

Control which fields are returned with `--view`:

| View      | Description                                            |
| --------- | ------------------------------------------------------ |
| `summary` | Key fields for quick overview (default)                |
| `ids`     | Minimal response - just IDs                            |
| `full`    | Extended field set with more details                   |
| `raw`     | Empty base selection - use with `--select`/`--selection` |
| `all`     | All available fields (auto-prunes access-denied fields) |

### Customizing Field Selection

Add fields to the base view with `--select`:

```bash
shop products list --select seo.title --select seo.description
```

Include connections when using `--view all`:

```bash
shop products get --id 123 --view all --include variants --include images
```

Override selection entirely with raw GraphQL:

```bash
shop products list --selection "{ id title handle }"
shop products list --selection @fields.gql
```

### Inline Fragments (Union/Interface Types)

Some fields return interface or union types (e.g., `Catalog` can be `AppCatalog`, `MarketCatalog`, etc.). Use inline fragments to select type-specific fields.

With `--select`, use the `on_TypeName` prefix:

```bash
# Select apps from an AppCatalog via publications
shop products get --id 123 --include resourcePublicationsV2 \
  --select resourcePublicationsV2.nodes.publication.catalog.on_AppCatalog.apps.nodes.title
```

With `--selection`, use standard GraphQL inline fragment syntax:

```bash
shop publications list --selection '{
  id
  catalog {
    title
    ... on AppCatalog {
      apps(first: 5) {
        nodes { title handle }
      }
    }
  }
}'
```

Or load from a file:

```bash
shop publications list --selection @my-selection.gql
```

### Quiet Mode

Use `--quiet` to output only IDs:

```bash
shop products list --quiet
```

## Common Flags

| Flag          | Description                              |
| ------------- | ---------------------------------------- |
| `--first N`   | Limit results (default: 50)              |
| `--after`     | Cursor for pagination                    |
| `--query`     | Search/filter query                      |
| `--published` | Products only: filter to published products (adds `published_status:published` to `--query`) |
| `--sort`      | Sort key                                 |
| `--reverse`   | Reverse sort order                       |
| `--id`        | Resource ID (for get/update/delete)      |
| `--set`       | Set a field value (repeatable)           |
| `--set-json`  | Set a field value as JSON (repeatable)   |
| `--tags`      | Comma-separated tags                     |
| `--dry-run`   | Print GraphQL operation without executing |

## Raw GraphQL

Execute arbitrary GraphQL queries or mutations:

```bash
shop graphql "{ shop { name } }"
shop graphql @query.graphql
shop graphql @mutation.graphql --var id=gid://shopify/Product/123 --var title="New Title"
shop graphql @query.graphql --variables '{"first": 10}'
shop graphql @query.graphql --variables @vars.json
```

Use `--no-validate` to skip local schema validation.

## Examples

```bash
# List products
shop products list --first 5

# List only published products (adds published_status:published to --query)
shop products list --published

# Get a specific product
shop products get --id 123

# Create a product
shop products create --set title="My Product" --set status="ACTIVE"

# Update a product
shop products update --id 123 --set title="Updated Title"

# Add tags to a product
shop products add-tags --id 123 --tags "summer,featured"

# Publish to a sales channel
shop publications resolve --publication "Online Store"
shop products publish --id 123 --publication "Online Store" --now

# Work with metafields
shop products metafields upsert --id 123 \
  --set namespace=custom \
  --set key=foo \
  --set type=single_line_text_field \
  --set value=bar

# List orders with table output
shop orders list --first 10 --format table

# Export all product IDs
shop products list --quiet > product-ids.txt
```

## Field Introspection

View available fields for any resource:

```bash
shop products fields
shop orders fields --format json
```

## Resources

| Resource | Verbs |
| -------- | ----- |
| `abandoned-checkouts` | list, count, abandonment, abandonment-by-checkout, update-email-state, update-activity-delivery-status, fields |
| `app-billing` | purchase-one-time-create, subscription-create, subscription-trial-extend, usage-record-create, uninstall, revoke-access-scopes, create-one-time, create-subscription, cancel-subscription, update-line-item, extend-trial, create-usage-record, get-installation, list-subscriptions, fields |
| `apps` | get, by-handle, by-key, installations, current-installation, discount-type, discount-types, discount-types-nodes, fields |
| `articles` | authors, tags, create, get, list, update, publish, unpublish, delete, fields |
| `backup` | available-regions, region, region-update, fields |
| `blogs` | create, get, list, count, update, publish, unpublish, delete, fields |
| `bulk-operations` | run-query, run-mutation, get, list, current, job, cancel, fields |
| `business-entities` | list, get, fields |
| `carrier-services` | create, get, list, list-available, update, delete, fields |
| `cart-transforms` | create, list, delete, fields |
| `cash-tracking` | get, list, fields |
| `catalogs` | create, get, list, count, operations, context-update, update, delete, fields |
| `channels` | get, list, fields |
| `checkout-branding` | get, upsert |
| `checkout-profiles` | get, list, fields |
| `collections` | create, get, by-handle, by-identifier, rules-conditions, list, count, update, delete, duplicate, add-products, remove-products, reorder-products, publish, unpublish, fields |
| `comments` | approve, spam, not-spam, get, list, delete, fields |
| `companies` | create, get, list, count, update, delete, address-delete, bulk-delete, assign-main-contact, revoke-main-contact, assign-customer, fields |
| `company-contacts` | get, role-get, create, update, delete, bulk-delete, assign-role, assign-roles, revoke-role, revoke-roles, remove-from-company, send-welcome-email, fields |
| `company-locations` | get, list, create, update, delete, bulk-delete, assign-address, assign-roles, revoke-roles, assign-staff, remove-staff, assign-tax-exemptions, revoke-tax-exemptions, create-tax-registration, revoke-tax-registration, update-tax-settings, fields |
| `config` | get, update-policy, enable-locale, disable-locale, update-locale, get-locales, fields |
| `customer-account-pages` | get, list, fields |
| `customer-payment-methods` | get, credit-card-create, credit-card-update, paypal-billing-agreement-create, paypal-billing-agreement-update, remote-create, revoke, send-update-email, duplication-data-get, duplication-create, update-url-get, fields |
| `customer-privacy` | privacy-settings, privacy-features-disable, consent-policy, consent-policy-regions, consent-policy-update, data-sale-opt-out, fields |
| `customer-segments` | members, members-query, membership, members-query-create, fields |
| `customers` | create, get, by-identifier, list, count, set, update, delete, address-create, address-update, address-delete, update-default-address, email-marketing-consent-update, sms-marketing-consent-update, add-tax-exemptions, remove-tax-exemptions, replace-tax-exemptions, generate-account-activation-url, request-data-erasure, cancel-data-erasure, metafields upsert, add-tags, remove-tags, merge, merge-preview, merge-job-status, send-invite, fields |
| `delegate-tokens` | create, destroy |
| `delivery-customizations` | create, get, list, update, delete, activate, fields |
| `delivery-profile-locations` | available, available-connection, fields |
| `delivery-profiles` | create, get, list, update, delete, fields |
| `delivery-promises` | get-settings, get-participants, get-provider, provider, update-participants, upsert-provider, provider-upsert |
| `delivery-settings` | setting-update, shipping-origin-assign |
| `discount-nodes` | get, list, count, fields |
| `discount-redeem-codes` | get-bulk-creation, bulk-delete, fields |
| `discount-saved-searches` | automatic, code, redeem-code, fields |
| `discounts-automatic` | get, list, get-discount, list-discounts, create-basic, create-bxgy, create-free-shipping, create-app, update-basic, update-bxgy, update-free-shipping, update-app, delete, bulk-delete, activate, deactivate, fields |
| `discounts-code` | get, get-by-code, list, count, create-basic, create-bxgy, create-free-shipping, create-app, update-basic, update-bxgy, update-free-shipping, update-app, delete, bulk-delete, activate, deactivate, bulk-activate, bulk-deactivate, add-redeem-codes, delete-redeem-codes, fields |
| `disputes` | get, list, evidence get, evidence update |
| `draft-orders` | get, list, count, create, update, delete, duplicate, calculate, complete, create-from-order, preview-invoice, send-invoice, bulk-add-tags, bulk-remove-tags, bulk-delete, tags, saved-searches, delivery-options, saved-search, fields |
| `events` | get, list, count, fields |
| `file-saved-searches` | list, fields |
| `files` | get, list, upload, update, delete, fields |
| `finance` | payout, payouts, fields |
| `flow` | generate-signature, trigger-receive |
| `fulfillment-constraint-rules` | list, create, update, delete |
| `fulfillment-orders` | get, list, accept-request, reject-request, submit-request, accept-cancellation, reject-cancellation, submit-cancellation, cancel, close, open, hold, release-hold, reschedule, move, split, merge, report-progress, mark-prepared, set-deadline, reroute, fields |
| `fulfillment-services` | get, list, create, update, delete, fields |
| `fulfillments` | get, create, cancel, update-tracking, create-event, fields |
| `gift-cards` | get, list, count, config, create, update, credit, debit, deactivate, notify-customer, notify-recipient, fields |
| `graphql` | query, mutation |
| `inventory` | list, set, adjust, move |
| `inventory-items` | get, list, update, fields |
| `inventory-shipments` | get, create, create-in-transit, delete, add-items, remove-items, update-quantities, mark-in-transit, receive, set-tracking, fields |
| `inventory-transfers` | get, list, create, create-ready, edit, duplicate, mark-ready, cancel, set-items, remove-items, delete, fields |
| `locales` | list, fields |
| `locations` | get, list, count, create, update, delete, activate, deactivate, enable-local-pickup, disable-local-pickup, fields |
| `market-localizations` | list, fields |
| `market-web-presences` | list, fields |
| `marketing-activities` | get, list, create, create-external, update, update-external, upsert-external, delete-external, delete-all-external, create-engagement, delete-engagements, fields |
| `marketing-events` | get, list, delete, fields |
| `markets` | create, get, list, update, delete, fields |
| `menus` | create, get, list, update, delete, fields |
| `metafield-definition-tools` | validate, fields |
| `metafield-definitions` | create, get, list, update, delete, fields |
| `metafields` | list, delete, fields |
| `metaobject-definition-tools` | validate, fields |
| `metaobject-definitions` | create, get, list, update, delete, fields |
| `metaobjects` | create, get, list, update, delete, fields |
| `mobile-platform-applications` | list, get, create, update, delete |
| `order-edit` | begin, get, commit, add-variant, add-custom-item, set-quantity, add-discount, remove-discount, update-discount, add-shipping, remove-shipping, update-shipping, fields |
| `orders` | create, get, list, count, update, delete, add-tags, remove-tags, cancel, close, mark-paid, add-note, fulfill, create-mandate-payment, transaction-void, fields |
| `pages` | create, get, list, count, update, publish, unpublish, delete, fields |
| `payment-customizations` | get, list, create, update, delete, set-enabled, fields |
| `payment-terms` | templates, create, update, delete, send-reminder, fields |
| `point-of-sale` | get, fields |
| `price-lists` | get, list, count, create, update, delete, add-prices, update-prices, update-prices-by-product, delete-prices, add-quantity-rules, delete-quantity-rules, update-quantity-pricing, fields |
| `product-feeds` | list, create, update, incremental-sync, full-sync, delete, fields |
| `product-variants` | upsert, get, get-by-identifier, list, count, update, bulk-create, bulk-update, bulk-delete, bulk-reorder, append-media, detach-media, join-selling-plans, leave-selling-plans, update-relationships, fields |
| `products` | create, get, by-handle, by-identifier, list, count, tags, types, vendors, update, delete, duplicate, archive, unarchive, set-status, change-status, set, join-selling-plan-groups, leave-selling-plan-groups, option-update, options-create, options-delete, options-reorder, combined-listing-update, add-tags, remove-tags, set-price, publish, unpublish, publish-all, bundle-create, bundle-update, metafields upsert, media add, media upload, media list, media remove, media update, media reorder, create-media, update-media, delete-media, reorder-media, duplicate-job, operation, fields |
| `publications` | resolve, create, get, list, update, delete, fields |
| `publishables` | get, list, fields |
| `refunds` | get, calculate, create, fields |
| `resource-feedback` | create, fields |
| `returnable-fulfillments` | list, fields |
| `returns` | get, reason-definitions, returnable-fulfillments, calculate, create, request, approve-request, decline-request, cancel, close, reopen, process, refund, remove-item, fields |
| `reverse-deliveries` | get, create, fields |
| `reverse-fulfillment-orders` | get, dispose, fields |
| `saved-searches` | create, update, delete, list-products, list-orders, list-customers, list-draft-orders, list-collections, fields |
| `script-tags` | create, get, list, update, delete, fields |
| `segments` | create, get, list, count, filters, filter-suggestions, value-suggestions, migrations, update, delete, fields |
| `selling-plan-group-products` | add-products, remove-products, add-product-variants, remove-product-variants, fields |
| `selling-plan-groups` | create, get, list, update, delete, add-variants, remove-variants, fields |
| `server-pixels` | get, create, delete, update-pubsub, pubsub-update, update-eventbridge, fields |
| `shipping-packages` | update, make-default, delete |
| `shop` | billing-preferences, domain, online-store, public-api-versions, shop-pay-receipt, shop-pay-receipts |
| `shop-policies` | list, update |
| `shop-utils` | feature-enabled, fields |
| `shopify-functions` | schema, fields |
| `shopify-payments` | account, get, payout-alternate-currency-create, fields |
| `staff` | me, get, list, fields |
| `staged-uploads` | target-generate, targets-generate, fields |
| `store-credit` | get, credit, debit, fields |
| `storefront-access-tokens` | list, get, create, create-basic, delete, fields |
| `subscription-billing` | get-attempt, list-attempts, create-attempt, get-cycle, list-cycles, charge, bulk-charge, bulk-search, skip-cycle, unskip-cycle, edit-schedule, edit-cycle, delete-edits |
| `subscription-billing-cycles` | attempts, bulk-results, get, charge, skip, unskip, schedule-edit, contract-edit, contract-draft-commit, contract-draft-concatenate, edit-delete, edits-delete, fields |
| `subscription-contracts` | get, list, create, atomic-create, update, activate, pause, cancel, expire, fail, set-next-billing, change-product, fields |
| `subscription-drafts` | get, commit, update, add-line, update-line, remove-line, add-discount, update-discount, remove-discount, apply-code, add-free-shipping, update-free-shipping, fields |
| `tags` | add, remove |
| `tax` | configure-app, create-summary |
| `taxonomy` | categories, list |
| `tender-transactions` | list, fields |
| `themes` | get, list, create, update, delete, duplicate, publish, files-upsert, files-delete, files-copy, fields |
| `translations` | get, list, list-by-ids, register, remove, fields |
| `types` | help |
| `url-redirects` | create, get, list, count, saved-searches, import-create, import-submit, import-get, bulk-delete-all, bulk-delete-ids, bulk-delete-saved-search, bulk-delete-search, update, delete, fields |
| `validations` | create, get, list, update, delete, fields |
| `web-pixels` | create, get, update, delete, fields |
| `web-presences` | list, create, update, delete, fields |
| `webhooks` | count, create, get, list, update, pubsub-create, pubsub-update, event-bridge-create, event-bridge-update, delete, fields |
