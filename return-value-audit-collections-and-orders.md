# CLI Return Value Audit — Collections & Orders

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

## Items worth changing (Collections & Orders)

### Collections (`collections.ts`)

### `collections add-products` / `collections remove-products` / `collections reorder-products`
All return an async `job` object with no information about which products were affected.
- Proposed: return `{ job, collectionId, productIds: [...] }` (or `{ job, collectionId, moves: [...] }` for reorder).
- `--quiet`: print `job.id` (since it’s async).

### `collections duplicate`
Returns both `collection` and `job`, which is ambiguous — the collection may not be in its final state yet since the job is still running.
- Should clarify which is authoritative, or return just the job with a note about the collection ID

---

### Orders (`orders.ts`)

### `orders cancel`
Returns a `job` object instead of the updated order or any refund details. User can't see what was cancelled.
- Proposed: return `{ job, orderId, refund, restock, reason }` at minimum; ideally also include `order` summary fields if API returns them.
- `--quiet`: print `job.id` (async).

### `orders capture`
Returns only the `transaction` object, with no reference to the order. No context about the order's resulting financial status.
- Proposed: return `{ orderId, transaction, order: { displayFinancialStatus? } }` (or at least `{ orderId, transaction }`).

### `orders risk-assessment-create`
Returns only the `orderRiskAssessment` with no order context.
- Proposed: return `{ orderId, orderRiskAssessment }`.

### `orders create-mandate-payment`
Returns a `job` object instead of the resulting payment transaction.
- Does return `paymentReferenceId` which helps, but no transaction details
- Should return: transaction with kind, status, amount

### `orders fulfill`
Returns a custom-wrapped array of `{ locationId, fulfillment, userErrors }`. The `locationId` is an internal CLI tracking value, not an API field — it leaks internal state to the user.
- Non-issue: the extra `locationId` is actually a real Location GID and is helpful context for “multi-location fulfill” cases. If we keep it, consider renaming to something explicit like `assignedLocationId` (so it’s clear it’s additional context, not an API field).

---

## General Patterns to Fix

1. **Sub-resource operations returning “bare parent”**: Returning the parent is fine *if* the updated child field is included (e.g. tags). Otherwise: return the child, or return the parent with the relevant field selected by default.

2. **Async job returns with no entity context**: When an operation kicks off a background job, include the IDs of the entities being acted on alongside the job ID so users know what's in flight.

3. **Quiet mode missing or wrong**: Quiet mode should always output the most useful ID(s) for the primary output (deleted IDs for deletes; job ID for async; node IDs for node outputs).

4. **Inconsistency within a resource**: When some commands in the same resource return the node wrapper (e.g. `codeDiscountNode`) and others return the inner type (e.g. `codeAppDiscount`), it makes scripting fragile.
