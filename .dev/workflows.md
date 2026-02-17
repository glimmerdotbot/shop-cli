Below is a **workflow layer** that sits _alongside_ your “raw CRUD-ish” commands. It follows the same conventions I proposed earlier:

- `shop <resource> <verb>`
- IDs: `--id` for the primary thing, otherwise explicit (`--product-id`, `--variant-ids`, etc.)
- Inputs: `--input @file.json` / `--input '<json>'` plus `--set` / `--set-json`
- Selection/output: `--select` / `--selection`, `--format`, `--quiet`
- **ID normalization (high value):** accept either a full GID or a numeric ID and coerce to `gid://shopify/...` when the resource type is implied by the command (`shop products publish --id 558169081`).

---

# Tier 1 Workflows (Core)

These are the ones that typically eliminate 80% of “GraphQL signature” pain for agents.

| Resource          | Workflow                        |     Kind | Score | CLI Command                        | Proposed args               |                                                                                                     |                                                                                  |           |
| ----------------- | ------------------------------- | -------: | ----: | ---------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- | --- |
| product           | Publish to channel(s)           | Workflow | **5** | `shop products publish`            | `--id <gid                  | num>` `--publication-id <gid>`\|`--publication <name                                                | handle>` `--at <iso>`\|`--now` `--include-unpublished?`                          |           |
| product           | Unpublish from channel(s)       | Workflow | **5** | `shop products unpublish`          | `--id <gid                  | num>` `--publication-id <gid>`\|`--publication <name>`                                              |                                                                                  |           |
| product           | Set product status              | Workflow | **5** | `shop products set-status`         | `--id <gid                  | num>` `--status ACTIVE                                                                              | DRAFT                                                                            | ARCHIVED` |
| product           | Add tags                        | Workflow | **5** | `shop products add-tags`           | `--id <gid                  | num>` `--tags <tag,tag>` (comma list)                                                               |                                                                                  |           |
| product           | Remove tags                     | Workflow | **5** | `shop products remove-tags`        | `--id <gid                  | num>` `--tags <tag,tag>`                                                                            |                                                                                  |           |
| product           | Upsert metafield(s) on product  | Workflow | **5** | `shop products metafields upsert`  | `--id <gid                  | num>` `--input <json                                                                                | @file>`\|`--set namespace=… --set key=… --set type=… --set value=…` (repeatable) |           |
| product           | Attach media (URL)              | Workflow | **5** | `shop products media add`          | `--id <gid                  | num>` `--url [https://…](https://…)`(repeatable)`--alt? <str>` `--media-type? IMAGE                 | VIDEO                                                                            | MODEL_3D` |
| product           | Attach media (file path)        | Workflow | **5** | `shop products media upload`       | `--id <gid                  | num>` `--file <path>`(repeatable)`--alt? <str>` _(internally does staged upload + create + attach)_ |                                                                                  |           |
| variant/inventory | Set inventory available         | Workflow | **5** | `shop inventory set`               | `--inventory-item-id <gid>` | `--variant-id <gid                                                                                  | num>` `--location-id <gid>` `--available <int>`                                  |           |     |
| variant/inventory | Adjust inventory (+/-)          | Workflow | **5** | `shop inventory adjust`            | `--inventory-item-id <gid>` | `--variant-id <gid                                                                                  | num>` `--location-id <gid>` `--delta <int>`                                      |           |     |
| product variant   | Bulk upsert variants            | Workflow | **5** | `shop product-variants upsert`     | `--product-id <gid          | num>` `--input <json                                                                                | @file>` _(wraps bulk create/update + validation)_                                |           |
| collection        | Add products to collection      | Workflow | **5** | `shop collections add-products`    | `--id <collection-gid       | num>` `--product-ids <gid                                                                           | num,...>`                                                                        |           |
| collection        | Remove products from collection | Workflow | **5** | `shop collections remove-products` | `--id <collection-gid       | num>` `--product-ids <gid                                                                           | num,...>`                                                                        |           |
| order             | Add tags                        | Workflow | **5** | `shop orders add-tags`             | `--id <gid                  | num>` `--tags <tag,tag>`                                                                            |                                                                                  |           |
| order             | Remove tags                     | Workflow | **5** | `shop orders remove-tags`          | `--id <gid                  | num>` `--tags <tag,tag>`                                                                            |                                                                                  |           |

Notes:

- `products publish/unpublish` should accept `--publication` (string) and resolve it via `publications list` internally, so the agent doesn’t have to juggle publication GIDs.
- The inventory workflows should accept either `--variant-id` (common) or `--inventory-item-id` (precise) and resolve the missing one.

---

# Tier 2 Workflows (Common)

| Resource              | Workflow                      |     Kind | Score | CLI Command                          | Proposed args                                                                                 |                                                  |                                                      |          |
| --------------------- | ----------------------------- | -------: | ----: | ------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- | -------- |
| metaobject            | Upsert metaobject by handle   | Workflow | **5** | `shop metaobjects upsert`            | `--type <str>` `--handle <str>` `--input <json                                                | @file>`\|`--set fields.foo=bar`                  |                                                      |          |
| metafield definition  | Ensure definition exists      | Workflow | **4** | `shop metafield-definitions ensure`  | `--owner-type <str>` `--namespace <str>` `--key <str>` `--type <str>` `--name <str>` `--pin?` |                                                  |                                                      |          |
| metaobject definition | Ensure definition exists      | Workflow | **4** | `shop metaobject-definitions ensure` | `--type <str>` `--input <json                                                                 | @file>`                                          |                                                      |          |
| menu                  | Upsert menu by handle         | Workflow | **4** | `shop menus upsert`                  | `--handle <str>` `--title? <str>` `--items <json                                              | @file>`                                          |                                                      |          |
| publication           | Resolve publication           | Workflow | **4** | `shop publications resolve`          | `--publication <name                                                                          | handle>`*(prints the GID, optionally`--quiet`)\* |                                                      |          |
| product               | Publish everywhere            | Workflow | **4** | `shop products publish-all`          | `--id <gid                                                                                    | num>` `--at <iso>                                | --now` _(internally lists publications + publishes)_ |          |
| product               | Sync variants from CSV/JSONL  | Workflow | **4** | `shop product-variants sync`         | `--product-id <gid                                                                            | num>` `--file <path>` `--format csv              | jsonl` `--mode upsert                                | replace` |
| file                  | Upload file(s) (return GIDs)  | Workflow | **4** | `shop files upload`                  | `--file <path>` (repeatable) `--alt? <str>` `--content-type? <mime>`                          |                                                  |                                                      |          |
| webhook               | Ensure webhook subscription   | Workflow | **4** | `shop webhooks ensure`               | `--topic <str>` `--endpoint <url>` `--format json                                             | pubsub                                           | eventbridge` `--secret? <str>`                       |          |
| inventory transfer    | Duplicate + optionally submit | Workflow | **4** | `shop inventory-transfers clone`     | `--id <gid>` `--set destinationLocationId=…` `--submit?`                                      |                                                  |                                                      |          |
| order edit            | “Add variant” convenience     | Workflow | **4** | `shop orders edit add-variant`       | `--edit-id <gid>` `--variant-id <gid                                                          | num>` `--quantity <int>`                         |                                                      |          |

---

# Tier 3 Workflows (Specialized)

| Resource      | Workflow                       |     Kind | Score | CLI Command                             | Proposed args                                       |                       |          |
| ------------- | ------------------------------ | -------: | ----: | --------------------------------------- | --------------------------------------------------- | --------------------- | -------- |
| draft order   | Complete + send invoice        | Workflow | **4** | `shop draft-orders finalize`            | `--id <gid>` `--send-invoice?` `--to? <email>`      |                       |          |
| draft order   | Bulk tag ops                   | Workflow | **4** | `shop draft-orders tags add` / `remove` | `--ids <gid,gid>` `--tags <tag,tag>`                |                       |          |
| url redirects | Sync redirects from file       | Workflow | **3** | `shop url-redirects sync`               | `--file <path>` `--format csv                       | jsonl` `--mode upsert | replace` |
| segments      | Upsert segment by name         | Workflow | **3** | `shop segments upsert`                  | `--name <str>` `--query <str>`                      |                       |          |
| gift cards    | Credit/debit with money parser | Workflow | **3** | `shop gift-cards credit` / `debit`      | `--id <gid>` `--amount <number>` `--currency <ISO>` |                       |          |

---

## A couple of “agent-proof” UX details I’d bake in

- **Always print userErrors by default** for workflows, _and_ exit non-zero if any userErrors exist (`--no-fail-on-user-errors` escape hatch).
- **`--dry-run`** prints the resolved variables + the GraphQL operation that would run (super useful for debugging).
- **`--explain`** prints which underlying queries/mutations were executed and why (for multi-step workflows like publish-by-name or upload media).

If you want, I can now do one of these next:

1. Pick the **top 12 workflows** to implement first (highest leverage for AI agents), or
2. For each workflow, sketch the **exact internal steps** (which queries/mutations, what to select, and what to validate/coerce).
