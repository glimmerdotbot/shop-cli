# Phase 2: Medium Effort Implementation Plan

**Objective:** Add 4 high-value resources with medium complexity to reach ~85% popular API coverage.
**Estimated Effort:** 10-14 days total
**Prerequisites:** Phase 1 complete (locations required for inventory operations)

---

## Resources in Phase 2

| Resource | Operations | Complexity | Impact |
|----------|-----------|------------|--------|
| Price Lists | 10 mutations + 3 queries | MEDIUM | HIGH (B2B/wholesale) |
| Discounts (Automatic + Codes) | 25+ mutations + 6 queries | HIGH | HIGH (marketing) |
| Inventory Transfers | 10 mutations + 2 queries | MEDIUM | MEDIUM (warehouse ops) |
| Refunds | 1 mutation + 1 query | LOW | MEDIUM (order lifecycle) |

---

## 1. Price Lists

**File:** `src/cli/verbs/price-lists.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop price-lists create` | `priceListCreate` | `--input` / `--set` |
| `shop price-lists get` | `priceList` | `--id` |
| `shop price-lists list` | `priceLists` | `--first`, pagination |
| `shop price-lists update` | `priceListUpdate` | `--id` + input |
| `shop price-lists delete` | `priceListDelete` | `--id`, `--yes` |
| `shop price-lists add-prices` | `priceListFixedPricesAdd` | `--id`, `--input` (prices array) |
| `shop price-lists update-prices` | `priceListFixedPricesUpdate` | `--id`, `--input` |
| `shop price-lists update-prices-by-product` | `priceListFixedPricesByProductUpdate` | `--id`, `--product-id`, `--input` |
| `shop price-lists delete-prices` | `priceListFixedPricesDelete` | `--id`, `--variant-ids` |
| `shop price-lists add-quantity-rules` | `quantityRulesAdd` | `--id`, `--input` |
| `shop price-lists delete-quantity-rules` | `quantityRulesDelete` | `--id`, `--variant-ids` |
| `shop price-lists update-quantity-pricing` | `quantityPricingByVariantUpdate` | `--id`, `--input` |

### Selections

```typescript
const priceListSummarySelection = {
  id: true,
  name: true,
  currency: true,
  catalog: { id: true, title: true },
  parent: {
    adjustment: {
      type: true,
      value: true,
    },
  },
  fixedPricesCount: true,
  quantityRulesCount: true,
} as const

const priceListFullSelection = {
  ...priceListSummarySelection,
  prices: {
    __args: { first: 10 },
    nodes: {
      variant: { id: true, displayName: true },
      price: { amount: true, currencyCode: true },
      compareAtPrice: { amount: true, currencyCode: true },
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
  quantityRules: {
    __args: { first: 10 },
    nodes: {
      variant: { id: true, displayName: true },
      minimum: true,
      maximum: true,
      increment: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
} as const
```

### Special Flags

- `--variant-ids <gid,gid,...>` for bulk operations
- `--product-id <gid>` for product-level price updates
- Standard flags

### Implementation Notes

- GID type: `PriceList`
- `priceListFixedPricesAdd` expects `prices: [{ variantId, price, compareAtPrice? }]`
- `quantityRulesAdd` expects `quantityRules: [{ variantId, minimum, maximum?, increment? }]`
- Price list is attached to a `Catalog` (Company Location Catalog for B2B, or Market Catalog)

---

## 2. Discounts (Combined Resource)

### 2a. Automatic Discounts

**File:** `src/cli/verbs/discounts-automatic.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop discounts-automatic create-basic` | `discountAutomaticBasicCreate` | `--input` |
| `shop discounts-automatic create-bxgy` | `discountAutomaticBxgyCreate` | `--input` |
| `shop discounts-automatic create-free-shipping` | `discountAutomaticFreeShippingCreate` | `--input` |
| `shop discounts-automatic create-app` | `discountAutomaticAppCreate` | `--function-id`, `--input` |
| `shop discounts-automatic get` | `automaticDiscountNode` | `--id` |
| `shop discounts-automatic list` | `automaticDiscountNodes` | `--first`, `--query` |
| `shop discounts-automatic update-basic` | `discountAutomaticBasicUpdate` | `--id` + input |
| `shop discounts-automatic update-bxgy` | `discountAutomaticBxgyUpdate` | `--id` + input |
| `shop discounts-automatic update-free-shipping` | `discountAutomaticFreeShippingUpdate` | `--id` + input |
| `shop discounts-automatic update-app` | `discountAutomaticAppUpdate` | `--id` + input |
| `shop discounts-automatic delete` | `discountAutomaticDelete` | `--id`, `--yes` |
| `shop discounts-automatic bulk-delete` | `discountAutomaticBulkDelete` | `--ids`, `--yes` |
| `shop discounts-automatic activate` | `discountAutomaticActivate` | `--id` |
| `shop discounts-automatic deactivate` | `discountAutomaticDeactivate` | `--id` |

### 2b. Discount Codes

**File:** `src/cli/verbs/discounts-code.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop discounts-code create-basic` | `discountCodeBasicCreate` | `--input` |
| `shop discounts-code create-bxgy` | `discountCodeBxgyCreate` | `--input` |
| `shop discounts-code create-free-shipping` | `discountCodeFreeShippingCreate` | `--input` |
| `shop discounts-code create-app` | `discountCodeAppCreate` | `--function-id`, `--input` |
| `shop discounts-code get` | `codeDiscountNode` | `--id` |
| `shop discounts-code get-by-code` | `codeDiscountNodeByCode` | `--code <string>` |
| `shop discounts-code list` | `codeDiscountNodes` | `--first`, `--query` |
| `shop discounts-code count` | `discountCodesCount` | `--query?` |
| `shop discounts-code update-basic` | `discountCodeBasicUpdate` | `--id` + input |
| `shop discounts-code update-bxgy` | `discountCodeBxgyUpdate` | `--id` + input |
| `shop discounts-code update-free-shipping` | `discountCodeFreeShippingUpdate` | `--id` + input |
| `shop discounts-code update-app` | `discountCodeAppUpdate` | `--id` + input |
| `shop discounts-code delete` | `discountCodeDelete` | `--id`, `--yes` |
| `shop discounts-code bulk-delete` | `discountCodeBulkDelete` | `--ids`, `--yes` |
| `shop discounts-code activate` | `discountCodeActivate` | `--id` |
| `shop discounts-code deactivate` | `discountCodeDeactivate` | `--id` |
| `shop discounts-code bulk-activate` | `discountCodeBulkActivate` | `--ids` |
| `shop discounts-code bulk-deactivate` | `discountCodeBulkDeactivate` | `--ids` |
| `shop discounts-code add-redeem-codes` | `discountRedeemCodeBulkAdd` | `--id`, `--codes <code,code,...>` |
| `shop discounts-code delete-redeem-codes` | `discountCodeRedeemCodeBulkDelete` | `--id`, `--ids` |

### Selections

```typescript
// Automatic discount node (wrapper type)
const automaticDiscountNodeSummarySelection = {
  id: true,
  automaticDiscount: {
    __typename: true,
    '... on DiscountAutomaticBasic': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      combinesWith: { orderDiscounts: true, productDiscounts: true, shippingDiscounts: true },
      asyncUsageCount: true,
      customerGets: {
        value: {
          '... on DiscountPercentage': { percentage: true },
          '... on DiscountAmount': { amount: { amount: true, currencyCode: true } },
        },
      },
    },
    '... on DiscountAutomaticBxgy': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usesPerOrderLimit: true,
    },
    '... on DiscountAutomaticFreeShipping': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
    '... on DiscountAutomaticApp': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      appDiscountType: { title: true, functionId: true },
    },
  },
} as const

// Code discount node
const codeDiscountNodeSummarySelection = {
  id: true,
  codeDiscount: {
    __typename: true,
    '... on DiscountCodeBasic': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      asyncUsageCount: true,
      codes: { __args: { first: 5 }, nodes: { code: true } },
    },
    '... on DiscountCodeBxgy': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      codes: { __args: { first: 5 }, nodes: { code: true } },
    },
    '... on DiscountCodeFreeShipping': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      codes: { __args: { first: 5 }, nodes: { code: true } },
    },
    '... on DiscountCodeApp': {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      codes: { __args: { first: 5 }, nodes: { code: true } },
      appDiscountType: { title: true, functionId: true },
    },
  },
} as const
```

### Implementation Notes

- GID types: `DiscountAutomaticNode`, `DiscountCodeNode`
- Discount types are polymorphic - use `__typename` and inline fragments
- Different verbs for different discount types (basic, bxgy, free-shipping, app)
- App discounts require `--function-id` to reference a Shopify Function
- Redeem codes are sub-resources of code discounts

### Complexity Notes

This is the most complex Phase 2 resource due to:
1. Multiple discount types with different schemas
2. Polymorphic return types requiring inline fragments
3. Many variations of create/update mutations
4. Bulk operations with different behaviors

Consider splitting into two files if too large.

---

## 3. Inventory Transfers

**File:** `src/cli/verbs/inventory-transfers.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop inventory-transfers create` | `inventoryTransferCreate` | `--input` |
| `shop inventory-transfers create-ready` | `inventoryTransferCreateAsReadyToShip` | `--input` |
| `shop inventory-transfers get` | `inventoryTransfer` | `--id` |
| `shop inventory-transfers list` | `inventoryTransfers` | `--first`, pagination |
| `shop inventory-transfers edit` | `inventoryTransferEdit` | `--id` + input |
| `shop inventory-transfers delete` | `inventoryTransferDelete` | `--id`, `--yes` |
| `shop inventory-transfers duplicate` | `inventoryTransferDuplicate` | `--id` |
| `shop inventory-transfers mark-ready` | `inventoryTransferMarkAsReadyToShip` | `--id` |
| `shop inventory-transfers cancel` | `inventoryTransferCancel` | `--id` |
| `shop inventory-transfers set-items` | `inventoryTransferSetItems` | `--id`, `--input` (items array) |
| `shop inventory-transfers remove-items` | `inventoryTransferRemoveItems` | `--id`, `--inventory-item-ids` |

### Selections

```typescript
const inventoryTransferSummarySelection = {
  id: true,
  number: true,
  status: true,
  referenceNumber: true,
  origin: { id: true, name: true },
  destination: { id: true, name: true },
  createdAt: true,
  expectedArrivalDate: true,
  totalQuantity: true,
} as const

const inventoryTransferFullSelection = {
  ...inventoryTransferSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      inventoryItem: { id: true, sku: true },
      quantity: true,
      receivedQuantity: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
  tags: true,
  note: true,
  events: {
    __args: { first: 10 },
    nodes: {
      id: true,
      createdAt: true,
      message: true,
    },
  },
} as const
```

### Special Flags

- `--origin-location-id <gid>` for create
- `--destination-location-id <gid>` for create
- `--inventory-item-ids <gid,gid,...>` for remove-items
- Standard flags

### Implementation Notes

- GID type: `InventoryTransfer`
- State machine: DRAFT → READY_TO_SHIP → IN_TRANSIT → RECEIVED
- `setItems` replaces all items; use for bulk updates
- `cancel` only works on DRAFT or READY_TO_SHIP status
- Depends on Locations from Phase 1

---

## 4. Refunds

**File:** `src/cli/verbs/refunds.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop refunds create` | `refundCreate` | `--order-id`, `--input` |
| `shop refunds get` | `refund` | `--id` |
| `shop refunds calculate` | (use suggestedRefund on Order) | `--order-id`, `--input` |

### Selections

```typescript
const refundSummarySelection = {
  id: true,
  createdAt: true,
  note: true,
  totalRefunded: { amount: true, currencyCode: true },
  order: { id: true, name: true },
  refundLineItems: {
    __args: { first: 20 },
    nodes: {
      lineItem: { id: true, title: true },
      quantity: true,
      restockType: true,
      subtotal: { amount: true, currencyCode: true },
    },
  },
} as const

const refundFullSelection = {
  ...refundSummarySelection,
  duties: {
    originalDuty: { id: true },
    amountSet: { shopMoney: { amount: true, currencyCode: true } },
  },
  transactions: {
    id: true,
    kind: true,
    status: true,
    amountSet: { shopMoney: { amount: true, currencyCode: true } },
    gateway: true,
  },
  refundShippingLines: {
    nodes: {
      shippingLine: { title: true },
      subtotal: { amount: true, currencyCode: true },
    },
  },
} as const
```

### Special Flags

- `--order-id <gid>` (required for create)
- `--notify` (boolean, send refund notification email)
- `--restock` (boolean, restock refunded items)
- Standard flags

### Implementation Notes

- GID type: `Refund`
- `refundCreate` input structure:
  ```typescript
  {
    orderId: string
    refundLineItems?: [{ lineItemId, quantity, restockType? }]
    shipping?: { fullRefund?: boolean, amount?: Money }
    note?: string
    notify?: boolean
  }
  ```
- No direct `refunds` list query - refunds are accessed via `order.refunds`
- `calculate` is not a mutation; it's a query on Order (`suggestedRefund`)

---

## Router Updates

Add to `src/cli/router.ts`:

```typescript
import { priceLists } from './verbs/price-lists.js'
import { discountsAutomatic } from './verbs/discounts-automatic.js'
import { discountsCode } from './verbs/discounts-code.js'
import { inventoryTransfers } from './verbs/inventory-transfers.js'
import { refunds } from './verbs/refunds.js'

// In router switch:
case 'price-lists': return priceLists(verb, args, ctx)
case 'discounts-automatic': return discountsAutomatic(verb, args, ctx)
case 'discounts-code': return discountsCode(verb, args, ctx)
case 'inventory-transfers': return inventoryTransfers(verb, args, ctx)
case 'refunds': return refunds(verb, args, ctx)
```

---

## Testing Checklist

For each resource:
- [ ] All create variants work (`create-basic`, `create-bxgy`, etc. for discounts)
- [ ] CRUD operations work
- [ ] Bulk operations work (where applicable)
- [ ] State transitions work (`activate`, `deactivate`, `mark-ready`, etc.)
- [ ] Polymorphic selections render correctly (discounts)
- [ ] Nested operations work (add-prices, set-items, etc.)
- [ ] Error handling for invalid states (e.g., cancel on shipped transfer)

---

## Consistency Requirements

Same as Phase 1, plus:

1. **Polymorphic types** use inline fragments with `__typename`:
   ```typescript
   '... on DiscountAutomaticBasic': { ... }
   ```

2. **Stateful resources** document valid state transitions in `--help`

3. **Bulk operations** require `--yes` for destructive actions

4. **Nested sub-resources** (like redeem codes) follow pattern:
   ```
   shop <parent-resource> <sub-operation> --id <parent-id> --sub-flags
   ```

---

## Definition of Done

- [ ] All 5 resource files implemented
- [ ] All operations tested (including state transitions)
- [ ] Polymorphic selections working correctly
- [ ] Bulk operations tested
- [ ] `.dev/cli-progress.md` updated
- [ ] No TypeScript errors
