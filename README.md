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
