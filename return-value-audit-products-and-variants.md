# CLI Return Value Audit — Products & Variants

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

## Items worth changing (Products & Variants)

### Products (`products.ts`)

#### `products media remove`
Currently returns the `fileUpdate` payload; `--quiet` prints the product ID.
- Proposed: treat this as “removing media references from a product” and return `{ productId, removedMediaIds: [...] }` (and in `--quiet` print the removed media IDs).
- If we want the “updated file” perspective instead, then `--quiet` should at least print the file IDs (not the product ID), matching `products media update`.

#### `products bundle-create` / `products bundle-update`
Returns a `productBundleOperation` (async operation object).
- Proposed: return `{ product: { id, title? }, operation: { id, status, … } }` (or make the product the primary output and include `operation.id` as context).
- `--quiet`: prefer printing the product ID for “create/update bundle on product” (operation ID is still available in non-quiet output).

---

## Product Variants (`product-variants.ts`)

### `product-variants bulk-create`
Returns a combined payload of `product` + `productVariants`. The wrapping makes it harder to extract just the created variants.
- Proposed: return the created variants as the primary output (list of nodes), and include `productId` as context if needed.

### `product-variants bulk-update`
Same as `bulk-create` — returns `product` + `productVariants` together.
- Proposed: return the updated variants as the primary output (list of nodes), and include `productId` as context if needed.

### `product-variants bulk-delete`
Returns only `product.id`. There is no confirmation of which variant IDs were deleted.
- Proposed: return `{ productId, deletedVariantIds: [...] }` (ideally from API; otherwise echo the requested IDs under a clearly named field like `requestedVariantIds`).
- `--quiet`: print the deleted variant IDs (one per line).

### `product-variants bulk-reorder`
Returns only `product.id`. No visibility into the new variant order.
- Proposed: return `{ productId, reorderedVariantIds: [...] }` (or full variants in new order if we can cheaply fetch them).

### `product-variants append-media` / `product-variants detach-media`
Returns `product` + all `productVariants`, not just the variants that were affected.
- Proposed: return the affected variant(s) as the primary output (list of nodes), plus `productId` as context.

---

## General Patterns to Fix

1. **Sub-resource operations returning “bare parent”**: Returning the parent is fine *if* the updated child field is included (e.g. tags). Otherwise: return the child, or return the parent with the relevant field selected by default.

2. **Async job returns with no entity context**: When an operation kicks off a background job, include the IDs of the entities being acted on alongside the job ID so users know what's in flight.

3. **Quiet mode missing or wrong**: Quiet mode should always output the most useful ID(s) for the primary output (deleted IDs for deletes; job ID for async; node IDs for node outputs).

4. **Inconsistency within a resource**: When some commands in the same resource return the node wrapper (e.g. `codeDiscountNode`) and others return the inner type (e.g. `codeAppDiscount`), it makes scripting fragile.

