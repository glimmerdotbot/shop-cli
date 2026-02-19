# CLI Return Value Audit — Customers, Inventory, Fulfillment

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

## Items worth changing (Customers, Inventory, Fulfillment)

### Customers (`customers.ts`)

### `customers update-default-address`
Returns the `customer` summary instead of the address that was set as default.
- Proposed: return `{ customerId, address: { ... , isDefault: true } }` (or return the address as the primary output).

### `customers email-marketing-consent-update` / `customers sms-marketing-consent-update`
Returns the `customer` summary instead of the updated consent state.
- Proposed: return `{ customerId, consent: ... }` (and make consent the primary output if that’s more useful).

### `customers add-tax-exemptions` / `customers remove-tax-exemptions` / `customers replace-tax-exemptions`
Returns the `customer` summary instead of the resulting exemptions list.
- Proposed: return `{ customerId, taxExemptions: [...] }` (where possible), or at least include `taxExemptions` in the default customer selection for these verbs.

### `customers merge`
Returns a `job` object. No visibility into the resulting merged customer.
- Should return: the resulting customer ID alongside the job

### `customers send-invite`
Returns the `customer` object. No indication of whether the invite was sent, to which email, or when.
- Should return: invite confirmation details (sent time, email, etc.)

### `customers request-data-erasure` / `customers cancel-data-erasure`
Returns only `customerId` with no erasure request details or status.
- Should return: erasure request ID + status

---

### Inventory (`inventory.ts`)

### `inventory deactivate`
Returns the `inventoryDeactivate` payload but it only contains `userErrors` — the deactivated inventory level is not included.
- Proposed: return `{ inventoryLevelId, deactivated: true }` at minimum (and `--quiet` prints `inventoryLevelId`), unless the API can return the actual `inventoryLevel`.

---

### Fulfillments (`fulfillments.ts`)

### `fulfillments create-event`
Creates a fulfillment event but returns only the event. No reference to the parent fulfillment.
- Proposed: return `{ fulfillmentId, fulfillmentEvent }`.

---

### Fulfillment Orders (`fulfillment-orders.ts`)

### `fulfillment-orders mark-prepared`
Returns only `userErrors` — no resource info whatsoever. User has no way to confirm what was marked as prepared.
- Should return: the affected fulfillment order IDs or line items

### `fulfillment-orders set-deadline`
Returns `{ success: true/false }` with no resource IDs. User can't tell which fulfillment orders had their deadline updated.
- Should return: the affected fulfillment order IDs

---

## General Patterns to Fix

1. **Sub-resource operations returning “bare parent”**: Returning the parent is fine *if* the updated child field is included (e.g. tags). Otherwise: return the child, or return the parent with the relevant field selected by default.

2. **Async job returns with no entity context**: When an operation kicks off a background job, include the IDs of the entities being acted on alongside the job ID so users know what's in flight.

3. **Quiet mode missing or wrong**: Quiet mode should always output the most useful ID(s) for the primary output (deleted IDs for deletes; job ID for async; node IDs for node outputs).

4. **Inconsistency within a resource**: When some commands in the same resource return the node wrapper (e.g. `codeDiscountNode`) and others return the inner type (e.g. `codeAppDiscount`), it makes scripting fragile.
