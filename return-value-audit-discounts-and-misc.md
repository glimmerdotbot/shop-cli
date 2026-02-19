# CLI Return Value Audit — Discounts & Misc

Audit of commands that return weird, unhelpful, or mismatched values — especially cases where we mutate a sub-resource but return something that doesn’t help the caller confirm what happened.

This file is intentionally self-contained: it includes the shared principles (top) and shared patterns (tail) needed to implement the changes in this section independently.

---

## Principles (aim for least-surprise)

### 1) Pick a “primary output” and stick to it
Each verb should have an obvious “primary thing” it returns:
- Create/update a resource → return that resource (or the affected sub-resource(s))
- Delete a resource → return the deleted ID(s)
- Kick off an async job → return the job **plus** enough context to know what’s in flight

### 2) Sub-resource mutations: return either (a) the child or (b) the parent *with the relevant child field populated*
Returning the parent can be great if the output includes the updated subresource state (and it’s reasonably small).

Example of a “good” pattern: `products add-tags` / `products remove-tags` returns the Product *including* `tags`, so you can immediately see the updated tags set.

Anti-pattern: returning the parent *without* the child field (or with a selection that omits the thing you just changed).

Heuristic for choosing (a) vs (b):
- If the child is “effectively a field on the parent” and callers usually want the *final set* (tags, options order, tax exemptions), return the parent with that field populated.
- If the child is a distinct node that callers usually want to reference next (address, media, region, fulfillment event, etc.), return the child node(s) (and include the parent ID as context).

### 3) `--view`, `--select`, `--selection`, `--include` apply to the **primary output**
This is the simplest mental model for humans and AI agents:
- If the verb returns a node (Product, Variant, Address, Media, …), those flags should shape that node (or list of nodes).
- If the verb returns a wrapper payload (e.g. `{ job, …context }`), selection flags generally don’t apply (and we shouldn’t pretend they do).

### 4) `--quiet` prints the most useful identifiers for the primary output
Rules of thumb:
- Primary output is a node → print its `id`
- Primary output is a list of nodes → print each `id` (one per line)
- Primary output is a delete → print deleted ID(s) (one per line)
- Primary output is an async job → print `job.id`

### 5) Prefer shapes that are friendly to `--format table|markdown|jsonl`
If we return multiple items, prefer returning them as “a list of nodes” (so `printConnection`/tables/jsonl behave naturally), rather than a single wrapper object containing many arrays.

### 6) Deletes: return IDs, not stale parents
For deletes (including “detach/remove” operations), aim for a small, explicit shape:
- Single delete → `{ deletedId }` (plus context like `{ parentId }` if useful)
- Bulk delete → `{ deletedIds: [...] }` (or `{ requestedIds: [...] }` if the API can’t confirm)

---

## Items worth changing (Discounts & Misc)

### Discounts (`discounts-automatic.ts`, `discounts-code.ts`)

### `discounts-automatic create-app` / `discounts-automatic update-app`
Returns `automaticAppDiscount` instead of `automaticDiscountNode` like every other discount type. Quiet mode returns `discountId` instead of the node ID.
- Inconsistent with all other discount create/update commands

### `discounts-code create-app` / `discounts-code update-app`
Same issue — returns `codeAppDiscount` instead of `codeDiscountNode`.
- Inconsistent with all other discount create/update commands

---

### Draft Orders (`draft-orders.ts`)

### `draft-orders calculate`
Returns a `calculatedDraftOrder` with only `lineItemsSubtotalPrice`. Very limited data for a calculation result.
- Should return: full calculated draft order summary (totals, taxes, line items, etc.)

---

### Selling Plan Groups (`selling-plan-groups.ts`)

### `selling-plan-groups remove-variants`
Returns `removedProductVariantIds` (the removed IDs) instead of the updated selling plan group — inconsistent with `add-variants` which returns the group.
- Quiet mode: returns **nothing at all**
- Proposed: return `{ sellingPlanGroup: { id, name? }, removedProductVariantIds: [...] }` and make `--quiet` print the group ID (or the removed variant IDs, but pick one and be consistent).

---

### Subscription Contracts (`subscription-contracts.ts`)

### `subscription-contracts create` / `subscription-contracts update`
Both return a `draft` object, not the actual subscription contract. This is an API design constraint, but confusing since the user just created/updated a contract and gets a draft back.
- Worth documenting/noting in help text (and ideally include the final contract ID whenever it’s available).

---

### Markets (`markets.ts`)

### `markets regions-create`
Creates regions but returns the parent `market` object — no visibility into which regions were created or their IDs.
- Should return: the created region objects

### `markets region-delete`
Deletes a region but returns both `deletedId` (the region) AND the parent `market`. The market is unnecessary for a delete operation.
- Should return: just `{ deletedId, userErrors }`

---

### Themes (`themes.ts`)

### `themes files-delete`
No quiet mode output at all — inconsistent with `files-upsert` and `files-copy`.
- Should print: deleted file count or filenames

### `themes files-copy`
No quiet mode output.
- Should print: copied file count or destination filenames

---

### URL Redirects (`url-redirects.ts`)

### `url-redirects bulk-delete-*` (all variants)
All return a `job` object with no indication of how many redirects were deleted or which ones.
- Should return: deletion count alongside job ID (if available from API)

### `url-redirects import-submit`
Returns a `job` object instead of the `urlRedirectImport` object, unlike `import-create` which returns the import. Inconsistent between the two import operations.
- Should return: the `urlRedirectImport` object (consistent with `import-create`)

---

### Metaobjects (`metaobjects.ts`)

### `metaobjects bulk-delete`
Returns only `job: { id, done }` — no indication of what was deleted or how many.
- Should return: deletion count or list of deleted IDs alongside job ID (if available from API)

---

## General Patterns to Fix

1. **Sub-resource operations returning “bare parent”**: Returning the parent is fine *if* the updated child field is included (e.g. tags). Otherwise: return the child, or return the parent with the relevant field selected by default.

2. **Async job returns with no entity context**: When an operation kicks off a background job, include the IDs of the entities being acted on alongside the job ID so users know what's in flight.

3. **Quiet mode missing or wrong**: Quiet mode should always output the most useful ID(s) for the primary output (deleted IDs for deletes; job ID for async; node IDs for node outputs).

4. **Inconsistency within a resource**: When some commands in the same resource return the node wrapper (e.g. `codeDiscountNode`) and others return the inner type (e.g. `codeAppDiscount`), it makes scripting fragile.
