# CLI Return Value Audit

Audit of commands that return weird, unhelpful, or mismatched values — especially cases where we mutate a sub-resource but return something that doesn’t help the caller confirm what happened.

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

## Items worth changing (by resource)

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

## Collections (`collections.ts`)

### `collections add-products` / `collections remove-products` / `collections reorder-products`
All return an async `job` object with no information about which products were affected.
- Proposed: return `{ job, collectionId, productIds: [...] }` (or `{ job, collectionId, moves: [...] }` for reorder).
- `--quiet`: print `job.id` (since it’s async).

### `collections duplicate`
Returns both `collection` and `job`, which is ambiguous — the collection may not be in its final state yet since the job is still running.
- Should clarify which is authoritative, or return just the job with a note about the collection ID

---

## Orders (`orders.ts`)

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

## Customers (`customers.ts`)

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

## Inventory (`inventory.ts`)

### `inventory deactivate`
Returns the `inventoryDeactivate` payload but it only contains `userErrors` — the deactivated inventory level is not included.
- Proposed: return `{ inventoryLevelId, deactivated: true }` at minimum (and `--quiet` prints `inventoryLevelId`), unless the API can return the actual `inventoryLevel`.

---

## Fulfillments (`fulfillments.ts`)

### `fulfillments create-event`
Creates a fulfillment event but returns only the event. No reference to the parent fulfillment.
- Proposed: return `{ fulfillmentId, fulfillmentEvent }`.

---

## Fulfillment Orders (`fulfillment-orders.ts`)

### `fulfillment-orders mark-prepared`
Returns only `userErrors` — no resource info whatsoever. User has no way to confirm what was marked as prepared.
- Should return: the affected fulfillment order IDs or line items

### `fulfillment-orders set-deadline`
Returns `{ success: true/false }` with no resource IDs. User can't tell which fulfillment orders had their deadline updated.
- Should return: the affected fulfillment order IDs

---

## Discounts (`discounts-automatic.ts`, `discounts-code.ts`)

### `discounts-automatic create-app` / `discounts-automatic update-app`
Returns `automaticAppDiscount` instead of `automaticDiscountNode` like every other discount type. Quiet mode returns `discountId` instead of the node ID.
- Inconsistent with all other discount create/update commands

### `discounts-code create-app` / `discounts-code update-app`
Same issue — returns `codeAppDiscount` instead of `codeDiscountNode`.
- Inconsistent with all other discount create/update commands

---

## Draft Orders (`draft-orders.ts`)

### `draft-orders calculate`
Returns a `calculatedDraftOrder` with only `lineItemsSubtotalPrice`. Very limited data for a calculation result.
- Should return: full calculated draft order summary (totals, taxes, line items, etc.)

---

## Selling Plan Groups (`selling-plan-groups.ts`)

### `selling-plan-groups remove-variants`
Returns `removedProductVariantIds` (the removed IDs) instead of the updated selling plan group — inconsistent with `add-variants` which returns the group.
- Quiet mode: returns **nothing at all**
- Proposed: return `{ sellingPlanGroup: { id, name? }, removedProductVariantIds: [...] }` and make `--quiet` print the group ID (or the removed variant IDs, but pick one and be consistent).

---

## Subscription Contracts (`subscription-contracts.ts`)

### `subscription-contracts create` / `subscription-contracts update`
Both return a `draft` object, not the actual subscription contract. This is an API design constraint, but confusing since the user just created/updated a contract and gets a draft back.
- Worth documenting/noting in help text (and ideally include the final contract ID whenever it’s available).

---

## Markets (`markets.ts`)

### `markets regions-create`
Creates regions but returns the parent `market` object — no visibility into which regions were created or their IDs.
- Should return: the created region objects

### `markets region-delete`
Deletes a region but returns both `deletedId` (the region) AND the parent `market`. The market is unnecessary for a delete operation.
- Should return: just `{ deletedId, userErrors }`

---

## Themes (`themes.ts`)

### `themes files-delete`
No quiet mode output at all — inconsistent with `files-upsert` and `files-copy`.
- Should print: deleted file count or filenames

### `themes files-copy`
No quiet mode output.
- Should print: copied file count or destination filenames

---

## URL Redirects (`url-redirects.ts`)

### `url-redirects bulk-delete-*` (all variants)
All return a `job` object with no indication of how many redirects were deleted or which ones.
- Should return: deletion count alongside job ID (if available from API)

### `url-redirects import-submit`
Returns a `job` object instead of the `urlRedirectImport` object, unlike `import-create` which returns the import. Inconsistent between the two import operations.
- Should return: the `urlRedirectImport` object (consistent with `import-create`)

---

## Metaobjects (`metaobjects.ts`)

### `metaobjects bulk-delete`
Returns only `job: { id, done }` — no indication of what was deleted or how many.
- Should return: deletion count or list of deleted IDs alongside job ID (if available from API)

---

## General Patterns to Fix

1. **Sub-resource operations returning “bare parent”**: Returning the parent is fine *if* the updated child field is included (e.g. tags). Otherwise: return the child, or return the parent with the relevant field selected by default.

2. **Async job returns with no entity context**: When an operation kicks off a background job, include the IDs of the entities being acted on alongside the job ID so users know what's in flight.

3. **Quiet mode missing or wrong**: Quiet mode should always output the most useful ID(s) for the primary output (deleted IDs for deletes; job ID for async; node IDs for node outputs).

4. **Inconsistency within a resource**: When some commands in the same resource return the node wrapper (e.g. `codeDiscountNode`) and others return the inner type (e.g. `codeAppDiscount`), it makes scripting fragile.
