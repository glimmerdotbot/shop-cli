Two constraints drive the design:

- GraphQL **forces explicit selection sets** (you can’t “return everything”). ([graphql.org][1])
- Shopify’s Admin GraphQL is **cost-based throttled**: more fields / deeper connections → higher query cost. ([Shopify][2])

## A good default strategy

### 1) Define 3–4 global “views” (presets)

Use the same view names everywhere:

- **`summary` (default)**: stable identifiers + a few “label” fields + timestamps/status
- **`ids`**: just IDs (for piping into other commands)
- **`full`**: richer nested data (still capped)
- **`raw`**: no defaults; requires `--select/--selection`

Then expose it consistently:

```bash
shop products list --view summary
shop products get --id ... --view full
shop products list --view raw --select id --select title
```

### 2) Default to “summary” that’s _object-first_, not “everything”

For any object type, pick:

- always: `id`
- best human label (first that exists): `title | name | displayName | handle | email`
- one status-ish field (first that exists): `status | state | isActive | publishedAt`
- timestamps: `updatedAt` (and sometimes `createdAt`)
- one small count field if it exists and is scalar-ish (`*_count`, `*Count`, etc.)

**Avoid by default**:

- large HTML/text fields (`descriptionHtml`, `bodyHtml`, etc.)
- heavy connections (`variants`, `lineItems`, `metafields`, `events`, `images`) unless view is `full` or user asked

This keeps results readable _and_ reduces query cost/throttling risk. ([Shopify][2])

### 3) Treat “get” and “list” differently

**List defaults** should _always_ include pagination info:

- `pageInfo { hasNextPage endCursor }`
- then a shallow node summary

Prefer `nodes { … }` when the schema offers it; otherwise `edges { cursor node { … } }`.

**Get defaults** can include a tiny bit more (still summary-ish), but shouldn’t explode into nested collections.

### 4) Make defaults composable, not rigid

Let users/agents:

- add fields on top of defaults (`--select …`)
- replace defaults entirely (`--view raw` or `--no-default-select`)
- save org-specific overrides (`shop config set defaults.products.summary=...`)

### 5) Use schema-driven heuristics (so it works across many resources)

Since you’re generating from the schema, you can implement a deterministic picker:

1. Collect fields of the return type.
2. Rank scalar fields by name (preferred list like `id`, `title`, `handle`, etc.).
3. Cap selection length (e.g., **6 fields** for list rows, **10** for get).
4. Never include object/connection fields unless the view is `full`.

This avoids hand-curating 100 resources while still producing good results.

### 6) Surface cost/throttle metadata in debug mode

Even if the selection set is small, it’s super helpful to show Shopify’s cost info when `--debug` is on (from response metadata), since cost scales with selected fields. ([Shopify][2])

## Concrete example defaults

**products list (summary)**

- `pageInfo { hasNextPage endCursor }`
- `nodes { id title handle status updatedAt }` _(fields depending on what exists)_

**products get (summary)**

- `id, title/name, handle, status, tags (if cheap), updatedAt`

…and then `--view full` might add _limited_ nested bits, e.g. first 10 variants’ ids/titles, first image, etc., but always with hard caps.

## How to decide “what’s in summary”

A simple rule that works well in practice:

- If it’s something you’d want as a **column in a table**, it belongs in `summary`.
- If it’s something you’d want only after you **open the record**, it belongs in `full`.
- If it’s “could be huge / unbounded,” it belongs only behind explicit flags (`--select/--selection`).

If you want, paste 3–5 “most used” resources (products, orders, customers, collections, inventory items) and I’ll propose specific `summary` and `full` presets that are consistent across them.

[1]: https://graphql.org/learn/queries/?utm_source=chatgpt.com "GraphQL - Queries"
[2]: https://shopify.dev/docs/api/admin-graphql/latest?utm_source=chatgpt.com "GraphQL Admin API reference"
