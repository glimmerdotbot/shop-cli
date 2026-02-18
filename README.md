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

Run `shop --help` to see all available resources and commands.

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
| `app-billing` | create-one-time, create-subscription, cancel-subscription, update-line-item, extend-trial, create-usage-record, get-installation, list-subscriptions, fields |
| `articles` | create, get, list, update, publish, unpublish, delete, fields |
| `blogs` | create, get, list, update, publish, unpublish, delete, fields |
| `bulk-operations` | run-query, run-mutation, get, list, current, cancel, fields |
| `business-entities` | list, get, fields |
| `carrier-services` | create, get, list, list-available, update, delete, fields |
| `cart-transforms` | create, list, delete, fields |
| `cash-tracking` | get, list, fields |
| `catalogs` | create, get, list, update, delete, fields |
| `checkout-branding` | get, upsert |
| `collections` | create, get, list, count, update, delete, duplicate, add-products, remove-products, reorder-products, publish, unpublish, fields |
| `comments` | get, list, delete, fields |
| `companies` | create, get, list, count, update, delete, bulk-delete, assign-main-contact, revoke-main-contact, assign-customer, fields |
| `company-contacts` | get, create, update, delete, bulk-delete, assign-role, assign-roles, revoke-role, revoke-roles, remove-from-company, send-welcome-email, fields |
| `company-locations` | get, list, create, update, delete, bulk-delete, assign-address, assign-roles, revoke-roles, assign-staff, remove-staff, assign-tax-exemptions, revoke-tax-exemptions, create-tax-registration, revoke-tax-registration, update-tax-settings, fields |
| `config` | get, update-policy, enable-locale, disable-locale, update-locale, get-locales, fields |
| `customer-account-pages` | get, list, fields |
| `customers` | create, get, list, count, update, delete, metafields upsert, add-tags, remove-tags, merge, send-invite, fields |
| `delegate-tokens` | create, destroy |
| `delivery-customizations` | create, get, list, update, delete, activate, fields |
| `delivery-profiles` | create, get, list, update, delete, fields |
| `delivery-promises` | get-settings, get-participants, get-provider, update-participants, upsert-provider |
| `discounts-automatic` | get, list, create-basic, create-bxgy, create-free-shipping, create-app, update-basic, update-bxgy, update-free-shipping, update-app, delete, bulk-delete, activate, deactivate, fields |
| `discounts-code` | get, get-by-code, list, count, create-basic, create-bxgy, create-free-shipping, create-app, update-basic, update-bxgy, update-free-shipping, update-app, delete, bulk-delete, activate, deactivate, bulk-activate, bulk-deactivate, add-redeem-codes, delete-redeem-codes, fields |
| `disputes` | get, list, evidence get, evidence update |
| `draft-orders` | get, list, count, create, update, delete, duplicate, calculate, complete, create-from-order, preview-invoice, send-invoice, bulk-add-tags, bulk-remove-tags, bulk-delete, saved-searches, tags, delivery-options, fields |
| `events` | get, list, count, fields |
| `files` | get, list, upload, update, delete, fields |
| `flow` | generate-signature, trigger-receive |
| `fulfillment-constraint-rules` | list, create, update, delete |
| `fulfillment-orders` | get, list, accept-request, reject-request, submit-request, accept-cancellation, reject-cancellation, submit-cancellation, cancel, close, open, hold, release-hold, reschedule, move, split, merge, report-progress, mark-prepared, set-deadline, reroute, fields |
| `fulfillment-services` | get, list, create, update, delete, fields |
| `fulfillments` | get, create, cancel, update-tracking, create-event, fields |
| `functions` | get, list, fields |
| `gift-cards` | get, list, count, config, create, update, credit, debit, deactivate, notify-customer, notify-recipient, fields |
| `inventory` | list, set, adjust, move |
| `inventory-items` | get, list, update, fields |
| `inventory-shipments` | get, create, create-in-transit, delete, add-items, remove-items, update-quantities, mark-in-transit, receive, set-tracking, fields |
| `inventory-transfers` | get, list, create, create-ready, edit, duplicate, mark-ready, cancel, set-items, remove-items, delete, fields |
| `locations` | get, list, count, create, update, delete, activate, deactivate, enable-local-pickup, disable-local-pickup, fields |
| `marketing-activities` | get, list, create, create-external, update, update-external, upsert-external, delete-external, delete-all-external, create-engagement, delete-engagements, fields |
| `markets` | create, get, list, update, delete, fields |
| `menus` | create, get, list, update, delete, fields |
| `metafield-definitions` | create, get, list, update, delete, fields |
| `metaobject-definitions` | create, get, list, update, delete, fields |
| `metaobjects` | create, get, list, update, delete, fields |
| `mobile-platform-applications` | list, get, create, update, delete |
| `order-edit` | begin, get, commit, add-variant, add-custom-item, set-quantity, add-discount, remove-discount, update-discount, add-shipping, remove-shipping, update-shipping, fields |
| `orders` | create, get, list, count, update, delete, add-tags, remove-tags, cancel, close, mark-paid, add-note, fulfill, create-mandate-payment, transaction-void, fields |
| `pages` | create, get, list, update, publish, unpublish, delete, fields |
| `payment-customizations` | get, list, create, update, delete, set-enabled, fields |
| `payment-terms` | templates, create, update, delete, send-reminder, fields |
| `point-of-sale` | get, fields |
| `price-lists` | get, list, create, update, delete, add-prices, update-prices, update-prices-by-product, delete-prices, add-quantity-rules, delete-quantity-rules, update-quantity-pricing, fields |
| `product-variants` | upsert, get, get-by-identifier, list, count, bulk-create, bulk-update, bulk-delete, bulk-reorder, append-media, detach-media, join-selling-plans, leave-selling-plans, update-relationships, fields |
| `products` | create, get, list, count, update, delete, duplicate, archive, unarchive, set-status, add-tags, remove-tags, set-price, publish, unpublish, publish-all, metafields upsert, media add, media upload, media list, media remove, media update, media reorder, bundle-create, bundle-update, fields |
| `publications` | resolve, create, get, list, update, delete, fields |
| `refunds` | get, calculate, create, fields |
| `returns` | get, reason-definitions, returnable-fulfillments, calculate, create, request, approve-request, decline-request, cancel, close, reopen, process, refund, remove-item, fields |
| `saved-searches` | create, update, delete, list-products, list-orders, list-customers, list-draft-orders, list-collections, fields |
| `script-tags` | create, get, list, update, delete, fields |
| `segments` | create, get, list, update, delete, fields |
| `selling-plan-groups` | create, get, list, update, delete, add-variants, remove-variants, fields |
| `server-pixels` | get, create, delete, update-pubsub, update-eventbridge, fields |
| `shipping-packages` | update, make-default, delete |
| `shop-policies` | list, update |
| `shopify-payments` | account, get, fields |
| `staff` | me, get, list, fields |
| `store-credit` | get, credit, debit, fields |
| `storefront-access-tokens` | list, get, create, delete, fields |
| `subscription-billing` | get-attempt, list-attempts, create-attempt, get-cycle, list-cycles, charge, bulk-charge, bulk-search, skip-cycle, unskip-cycle, edit-schedule, edit-cycle, delete-edits |
| `subscription-contracts` | get, list, create, atomic-create, update, activate, pause, cancel, expire, fail, set-next-billing, change-product, fields |
| `subscription-drafts` | get, commit, update, add-line, update-line, remove-line, add-discount, update-discount, remove-discount, apply-code, add-free-shipping, update-free-shipping, fields |
| `tags` | add, remove |
| `tax` | configure-app, create-summary |
| `taxonomy` | categories, list |
| `themes` | get, list, create, update, delete, duplicate, publish, files-upsert, files-delete, files-copy, fields |
| `translations` | get, list, list-by-ids, register, remove, fields |
| `url-redirects` | create, get, list, update, delete, fields |
| `validations` | create, get, list, update, delete, fields |
| `web-pixels` | create, get, update, delete, fields |
| `webhooks` | create, get, list, update, delete, fields |
