# Phase 3: Complex Workflows Implementation Plan

**Objective:** Add 4 mission-critical resources with complex state machines to reach ~95% popular API coverage.
**Estimated Effort:** 15-20 days total
**Prerequisites:** Phase 1 & 2 complete; understanding of fulfillment lifecycle

---

## Resources in Phase 3

| Resource | Operations | Complexity | Impact |
|----------|-----------|------------|--------|
| Returns | 11 mutations + 4 queries | HIGH | CRITICAL (post-purchase) |
| Fulfillment Orders | 25+ mutations + 3 queries | VERY HIGH | CRITICAL (fulfillment ops) |
| Subscriptions | 30+ mutations + 6 queries | VERY HIGH | HIGH (recurring revenue) |
| Order Edit | 10 mutations + 2 queries | MEDIUM | HIGH (customer service) |

---

## 1. Returns

**File:** `src/cli/verbs/returns.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop returns create` | `returnCreate` | `--order-id`, `--input` |
| `shop returns get` | `return` | `--id` |
| `shop returns calculate` | `returnCalculate` | `--order-id`, `--input` (preview) |
| `shop returns cancel` | `returnCancel` | `--id` |
| `shop returns close` | `returnClose` | `--id` |
| `shop returns reopen` | `returnReopen` | `--id` |
| `shop returns process` | `returnProcess` | `--id` |
| `shop returns refund` | `returnRefund` | `--id`, `--input` |
| `shop returns request` | `returnRequest` | `--order-id`, `--input` (customer request) |
| `shop returns approve-request` | `returnApproveRequest` | `--id` |
| `shop returns decline-request` | `returnDeclineRequest` | `--id`, `--decline-reason?` |
| `shop returns remove-item` | `returnLineItemRemoveFromReturn` | `--return-line-item-id` |
| `shop returns reason-definitions` | `returnReasonDefinitions` | (list reasons) |
| `shop returns returnable-fulfillments` | `returnableFulfillments` | `--order-id`, list |

### State Machine

```
REQUESTED → APPROVED → OPEN → IN_PROGRESS → CLOSED
    ↓           ↓        ↓
 DECLINED    CANCELLED  CANCELLED
```

### Selections

```typescript
const returnSummarySelection = {
  id: true,
  name: true,
  status: true,
  createdAt: true,
  order: { id: true, name: true },
  totalQuantity: true,
  returnLineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      quantity: true,
      returnReason: true,
      returnReasonNote: true,
      fulfillmentLineItem: {
        lineItem: { id: true, title: true },
      },
    },
  },
} as const

const returnFullSelection = {
  ...returnSummarySelection,
  decline: {
    reason: true,
    note: true,
  },
  suggestedRefund: {
    subtotal: { amount: true, currencyCode: true },
    totalTax: { amount: true, currencyCode: true },
    totalCartDiscountAmount: { amount: true, currencyCode: true },
    refundDuties: { amountSet: { shopMoney: { amount: true } } },
    shipping: { maximumRefundable: { amount: true, currencyCode: true } },
  },
  reverseDeliveries: {
    __args: { first: 5 },
    nodes: {
      id: true,
      deliverable: {
        '... on ReverseDeliveryShippingDeliverable': {
          label: { id: true },
          tracking: { number: true, url: true },
        },
      },
    },
  },
  reverseFulfillmentOrders: {
    __args: { first: 5 },
    nodes: {
      id: true,
      status: true,
    },
  },
  refunds: {
    __args: { first: 5 },
    nodes: {
      id: true,
      totalRefunded: { amount: true, currencyCode: true },
    },
  },
  exchangeLineItems: {
    __args: { first: 10 },
    nodes: {
      id: true,
      lineItem: { id: true, title: true },
    },
  },
} as const

const returnReasonDefinitionSelection = {
  id: true,
  name: true,
  reason: true,
} as const
```

### Special Flags

- `--order-id <gid>` for create/request
- `--return-line-item-id <gid>` for remove-item
- `--decline-reason <string>` for decline-request
- `--notify-customer` (boolean) for state changes
- Standard flags

### Implementation Notes

- GID type: `Return`
- `returnCalculate` is a query (preview), not a mutation
- `returnRequest` creates a return requiring merchant approval (from customer)
- `returnCreate` creates a return directly (merchant-initiated)
- `returnRefund` issues a refund; requires Phase 2's Refunds understanding
- `returnProcess` marks items as received
- Returns have related `ReverseDelivery` (shipping label back) and `ReverseFulfillmentOrder` resources

---

## 2. Fulfillment Orders

**File:** `src/cli/verbs/fulfillment-orders.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop fulfillment-orders get` | `fulfillmentOrder` | `--id` |
| `shop fulfillment-orders list` | `fulfillmentOrders` | `--first`, `--status?`, `--location-ids?` |
| `shop fulfillment-orders accept-request` | `fulfillmentOrderAcceptFulfillmentRequest` | `--id`, `--message?` |
| `shop fulfillment-orders reject-request` | `fulfillmentOrderRejectFulfillmentRequest` | `--id`, `--reason`, `--message?` |
| `shop fulfillment-orders submit-request` | `fulfillmentOrderSubmitFulfillmentRequest` | `--id` |
| `shop fulfillment-orders accept-cancellation` | `fulfillmentOrderAcceptCancellationRequest` | `--id`, `--message?` |
| `shop fulfillment-orders reject-cancellation` | `fulfillmentOrderRejectCancellationRequest` | `--id`, `--message?` |
| `shop fulfillment-orders submit-cancellation` | `fulfillmentOrderSubmitCancellationRequest` | `--id`, `--message?` |
| `shop fulfillment-orders cancel` | `fulfillmentOrderCancel` | `--id` |
| `shop fulfillment-orders close` | `fulfillmentOrderClose` | `--id`, `--message?` |
| `shop fulfillment-orders open` | `fulfillmentOrderOpen` | `--id` |
| `shop fulfillment-orders hold` | `fulfillmentOrderHold` | `--id`, `--reason`, `--notes?` |
| `shop fulfillment-orders release-hold` | `fulfillmentOrderReleaseHold` | `--id` |
| `shop fulfillment-orders reschedule` | `fulfillmentOrderReschedule` | `--id`, `--fulfill-at` |
| `shop fulfillment-orders move` | `fulfillmentOrderMove` | `--id`, `--location-id` |
| `shop fulfillment-orders split` | `fulfillmentOrderSplit` | `--id`, `--input` (line splits) |
| `shop fulfillment-orders merge` | `fulfillmentOrderMerge` | `--ids` (multiple FO IDs) |
| `shop fulfillment-orders report-progress` | `fulfillmentOrderReportProgress` | `--id`, `--status`, `--message?` |
| `shop fulfillment-orders mark-prepared` | `fulfillmentOrderLineItemsPreparedForPickup` | `--id` |
| `shop fulfillment-orders set-deadline` | `fulfillmentOrdersSetFulfillmentDeadline` | `--ids`, `--deadline` |
| `shop fulfillment-orders reroute` | `fulfillmentOrdersReroute` | `--ids`, `--location-id` |

### Fulfillments (related)

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop fulfillments create` | `fulfillmentCreateV2` | `--input` (fulfillment order IDs + tracking) |
| `shop fulfillments get` | `fulfillment` | `--id` |
| `shop fulfillments cancel` | `fulfillmentCancel` | `--id` |
| `shop fulfillments update-tracking` | `fulfillmentTrackingInfoUpdateV2` | `--id`, `--tracking-info` |
| `shop fulfillments create-event` | `fulfillmentEventCreate` | `--id`, `--status`, `--message?` |

### State Machine (Fulfillment Order)

```
                    ┌─── SCHEDULED ───┐
                    ↓                 │
OPEN → ON_HOLD → IN_PROGRESS → FULFILLED
  │        │         │             │
  └── INCOMPLETE ←───┴─────────────┘
           │
        CLOSED / CANCELLED
```

### Request Flow (for fulfillment services)
```
UNSUBMITTED → SUBMITTED → ACCEPTED → (fulfill)
                  ↓
              REJECTED

CANCELLATION_REQUESTED → CANCELLATION_ACCEPTED
                     ↓
               CANCELLATION_REJECTED
```

### Selections

```typescript
const fulfillmentOrderSummarySelection = {
  id: true,
  status: true,
  requestStatus: true,
  order: { id: true, name: true },
  assignedLocation: {
    name: true,
    location: { id: true },
  },
  fulfillAt: true,
  fulfillBy: true,
  supportedActions: { action: true, externalUrl: true },
  lineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      totalQuantity: true,
      remainingQuantity: true,
      lineItem: { id: true, title: true, sku: true },
    },
  },
} as const

const fulfillmentOrderFullSelection = {
  ...fulfillmentOrderSummarySelection,
  destination: {
    firstName: true,
    lastName: true,
    address1: true,
    city: true,
    provinceCode: true,
    countryCode: true,
    zip: true,
    phone: true,
  },
  fulfillmentHolds: {
    __args: { first: 5 },
    nodes: {
      id: true,
      reason: true,
      reasonNotes: true,
      heldBy: true,
    },
  },
  merchantRequests: {
    __args: { first: 5 },
    nodes: {
      id: true,
      kind: true,
      message: true,
      requestedAt: true,
      responseData: true,
    },
  },
  fulfillments: {
    __args: { first: 5 },
    nodes: {
      id: true,
      status: true,
      trackingInfo: {
        company: true,
        number: true,
        url: true,
      },
    },
  },
  locationsForMove: {
    __args: { first: 10 },
    nodes: {
      location: { id: true, name: true },
      message: true,
      movable: true,
    },
  },
} as const

const fulfillmentSummarySelection = {
  id: true,
  status: true,
  name: true,
  createdAt: true,
  totalQuantity: true,
  trackingInfo: {
    company: true,
    number: true,
    url: true,
  },
  fulfillmentLineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      quantity: true,
      lineItem: { id: true, title: true },
    },
  },
} as const
```

### Special Flags

- `--location-id <gid>` for move/reroute
- `--location-ids <gid,gid,...>` for list filter
- `--status <OPEN|ON_HOLD|...>` for list filter
- `--reason <HoldReason>` for hold
- `--deadline <ISO datetime>` for set-deadline
- `--tracking-company <string>` for fulfillment tracking
- `--tracking-number <string>` for fulfillment tracking
- `--tracking-url <url>` for fulfillment tracking
- Standard flags

### Implementation Notes

- GID types: `FulfillmentOrder`, `Fulfillment`
- Very complex state machine with multiple valid transitions
- `fulfillmentCreateV2` accepts array of `{ fulfillmentOrderId, fulfillmentOrderLineItems }` to partially or fully fulfill
- Merge combines multiple FOs into one; split creates multiple from one
- Hold reasons: `INVENTORY_OUT_OF_STOCK`, `OTHER`, `AWAITING_PAYMENT`, `HIGH_RISK_OF_FRAUD`, `INCORRECT_ADDRESS`, `CUSTOMER_REQUESTED_HOLD`
- FulfillmentService integration uses request/accept/reject flow

---

## 3. Subscriptions

**Files:**
- `src/cli/verbs/subscription-contracts.ts`
- `src/cli/verbs/subscription-billing.ts`
- `src/cli/verbs/subscription-drafts.ts`

### 3a. Subscription Contracts

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop subscription-contracts get` | `subscriptionContract` | `--id` |
| `shop subscription-contracts list` | `subscriptionContracts` | `--first`, pagination |
| `shop subscription-contracts create` | `subscriptionContractCreate` | `--customer-id`, `--input` |
| `shop subscription-contracts atomic-create` | `subscriptionContractAtomicCreate` | `--input` (full contract) |
| `shop subscription-contracts update` | `subscriptionContractUpdate` | `--id` + input |
| `shop subscription-contracts activate` | `subscriptionContractActivate` | `--id` |
| `shop subscription-contracts pause` | `subscriptionContractPause` | `--id` |
| `shop subscription-contracts cancel` | `subscriptionContractCancel` | `--id` |
| `shop subscription-contracts expire` | `subscriptionContractExpire` | `--id` |
| `shop subscription-contracts fail` | `subscriptionContractFail` | `--id`, `--origin?` |
| `shop subscription-contracts set-next-billing` | `subscriptionContractSetNextBillingDate` | `--id`, `--date` |
| `shop subscription-contracts change-product` | `subscriptionContractProductChange` | `--id`, `--input` |

### 3b. Subscription Billing

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop subscription-billing get-attempt` | `subscriptionBillingAttempt` | `--id` |
| `shop subscription-billing list-attempts` | `subscriptionBillingAttempts` | `--contract-id`, pagination |
| `shop subscription-billing create-attempt` | `subscriptionBillingAttemptCreate` | `--contract-id`, `--input` |
| `shop subscription-billing get-cycle` | `subscriptionBillingCycle` | `--contract-id`, `--cycle-index` |
| `shop subscription-billing list-cycles` | `subscriptionBillingCycles` | `--contract-id`, pagination |
| `shop subscription-billing charge` | `subscriptionBillingCycleCharge` | `--contract-id`, `--cycle-index` |
| `shop subscription-billing bulk-charge` | `subscriptionBillingCycleBulkCharge` | `--contract-ids`, `--date?` |
| `shop subscription-billing bulk-search` | `subscriptionBillingCycleBulkSearch` | `--input` |
| `shop subscription-billing skip-cycle` | `subscriptionBillingCycleSkip` | `--contract-id`, `--cycle-index` |
| `shop subscription-billing unskip-cycle` | `subscriptionBillingCycleUnskip` | `--contract-id`, `--cycle-index` |
| `shop subscription-billing edit-schedule` | `subscriptionBillingCycleScheduleEdit` | `--contract-id`, `--input` |
| `shop subscription-billing edit-cycle` | `subscriptionBillingCycleContractEdit` | `--contract-id`, `--cycle-index` |
| `shop subscription-billing delete-edits` | `subscriptionBillingCycleEditsDelete` | `--contract-id`, `--cycle-indexes` |

### 3c. Subscription Drafts

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop subscription-drafts get` | `subscriptionDraft` | `--id` |
| `shop subscription-drafts commit` | `subscriptionDraftCommit` | `--id` |
| `shop subscription-drafts update` | `subscriptionDraftUpdate` | `--id`, `--input` |
| `shop subscription-drafts add-line` | `subscriptionDraftLineAdd` | `--id`, `--input` |
| `shop subscription-drafts update-line` | `subscriptionDraftLineUpdate` | `--id`, `--line-id`, `--input` |
| `shop subscription-drafts remove-line` | `subscriptionDraftLineRemove` | `--id`, `--line-id` |
| `shop subscription-drafts add-discount` | `subscriptionDraftDiscountAdd` | `--id`, `--input` |
| `shop subscription-drafts update-discount` | `subscriptionDraftDiscountUpdate` | `--id`, `--discount-id`, `--input` |
| `shop subscription-drafts remove-discount` | `subscriptionDraftDiscountRemove` | `--id`, `--discount-id` |
| `shop subscription-drafts apply-code` | `subscriptionDraftDiscountCodeApply` | `--id`, `--code` |
| `shop subscription-drafts add-free-shipping` | `subscriptionDraftFreeShippingDiscountAdd` | `--id`, `--input` |
| `shop subscription-drafts update-free-shipping` | `subscriptionDraftFreeShippingDiscountUpdate` | `--id`, `--input` |

### State Machine (Contract)

```
ACTIVE ↔ PAUSED
   ↓        ↓
CANCELLED  CANCELLED
   │
EXPIRED / FAILED
```

### Selections

```typescript
const subscriptionContractSummarySelection = {
  id: true,
  status: true,
  customer: { id: true, displayName: true, email: true },
  nextBillingDate: true,
  billingPolicy: {
    interval: true,
    intervalCount: true,
    minCycles: true,
    maxCycles: true,
  },
  deliveryPolicy: {
    interval: true,
    intervalCount: true,
  },
  lines: {
    __args: { first: 10 },
    nodes: {
      id: true,
      variantId: true,
      title: true,
      variantTitle: true,
      quantity: true,
      currentPrice: { amount: true, currencyCode: true },
    },
  },
  currencyCode: true,
  createdAt: true,
} as const

const subscriptionContractFullSelection = {
  ...subscriptionContractSummarySelection,
  originOrder: { id: true, name: true },
  deliveryMethod: {
    '... on SubscriptionDeliveryMethodShipping': {
      address: {
        firstName: true,
        lastName: true,
        address1: true,
        city: true,
        provinceCode: true,
        countryCode: true,
        zip: true,
      },
      shippingOption: { title: true, presentmentTitle: true },
    },
    '... on SubscriptionDeliveryMethodLocalDelivery': {
      address: { address1: true, city: true },
      localDeliveryOption: { title: true },
    },
    '... on SubscriptionDeliveryMethodPickup': {
      pickupOption: { title: true, locationId: true },
    },
  },
  customerPaymentMethod: {
    id: true,
    instrument: {
      '... on CustomerCreditCard': { lastDigits: true, brand: true, expiryYear: true, expiryMonth: true },
      '... on CustomerPaypalBillingAgreement': { paypalAccountEmail: true },
    },
  },
  discounts: {
    __args: { first: 5 },
    nodes: {
      id: true,
      title: true,
      value: {
        '... on SubscriptionDiscountFixedAmountValue': { amount: { amount: true } },
        '... on SubscriptionDiscountPercentageValue': { percentage: true },
      },
    },
  },
  orders: {
    __args: { first: 5 },
    nodes: {
      id: true,
      name: true,
      createdAt: true,
    },
  },
  billingAttempts: {
    __args: { first: 5 },
    nodes: {
      id: true,
      ready: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
    },
  },
} as const
```

### Special Flags

- `--customer-id <gid>` for create
- `--contract-id <gid>` for billing operations
- `--cycle-index <int>` for cycle-specific operations
- `--date <ISO>` for scheduling
- `--line-id <gid>` for line operations
- `--discount-id <gid>` for discount operations
- `--code <string>` for discount code application
- Standard flags

### Implementation Notes

- GID types: `SubscriptionContract`, `SubscriptionDraft`, `SubscriptionBillingAttempt`, `SubscriptionBillingCycle`
- Contracts are created as drafts via `subscriptionContractCreate`, then activated
- `subscriptionContractAtomicCreate` creates and activates in one step
- Billing cycles are indexed (1, 2, 3, ...) not by ID
- `subscriptionBillingAttemptCreate` triggers a charge attempt
- Delivery method is polymorphic (shipping, local delivery, pickup)
- Payment method is polymorphic (credit card, PayPal)

---

## 4. Order Edit

**File:** `src/cli/verbs/order-edit.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop order-edit begin` | `orderEditBegin` | `--order-id` |
| `shop order-edit get` | `orderEditSession` | `--order-id` (or implicit from begin) |
| `shop order-edit commit` | `orderEditCommit` | `--id`, `--staff-note?` |
| `shop order-edit add-variant` | `orderEditAddVariant` | `--id`, `--variant-id`, `--quantity` |
| `shop order-edit add-custom-item` | `orderEditAddCustomItem` | `--id`, `--title`, `--price`, `--quantity` |
| `shop order-edit set-quantity` | `orderEditSetQuantity` | `--id`, `--line-item-id`, `--quantity` |
| `shop order-edit add-discount` | `orderEditAddLineItemDiscount` | `--id`, `--line-item-id`, `--input` |
| `shop order-edit remove-discount` | `orderEditRemoveLineItemDiscount` | `--id`, `--discount-application-id` |
| `shop order-edit update-discount` | `orderEditUpdateDiscount` | `--id`, `--discount-application-id`, `--input` |
| `shop order-edit add-shipping` | `orderEditAddShippingLine` | `--id`, `--input` |
| `shop order-edit remove-shipping` | `orderEditRemoveShippingLine` | `--id`, `--shipping-line-id` |
| `shop order-edit update-shipping` | `orderEditUpdateShippingLine` | `--id`, `--shipping-line-id`, `--input` |

### Workflow

```
1. Begin edit session (orderEditBegin) → returns CalculatedOrder
2. Make changes (add/remove variants, adjust quantities, discounts)
3. Each change updates the CalculatedOrder state
4. Commit changes (orderEditCommit) → finalizes order
```

### Selections

```typescript
const calculatedOrderSummarySelection = {
  id: true,
  order: { id: true, name: true },
  originalOrder: { subtotalPriceSet: { shopMoney: { amount: true } } },
  subtotalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  totalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  totalOutstandingSet: { shopMoney: { amount: true, currencyCode: true } },
  addedLineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      calculatedDiscountAllocations: {
        allocatedAmountSet: { shopMoney: { amount: true } },
      },
    },
  },
  stagedChanges: {
    __args: { first: 20 },
    nodes: {
      __typename: true,
      '... on OrderStagedChangeAddVariant': {
        quantity: true,
        variant: { id: true, title: true },
      },
      '... on OrderStagedChangeAddCustomItem': {
        title: true,
        quantity: true,
        price: { amount: true, currencyCode: true },
      },
      '... on OrderStagedChangeIncrementItem': {
        delta: true,
        lineItem: { id: true, title: true },
      },
      '... on OrderStagedChangeDecrementItem': {
        delta: true,
        lineItem: { id: true, title: true },
        restock: true,
      },
    },
  },
} as const

const calculatedOrderFullSelection = {
  ...calculatedOrderSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      stagedChanges: true,
      originalUnitPriceSet: { shopMoney: { amount: true } },
      calculatedDiscountAllocations: {
        allocatedAmountSet: { shopMoney: { amount: true } },
        discountApplication: { title: true },
      },
    },
  },
  cartDiscountAmountSet: { shopMoney: { amount: true } },
  taxLines: { title: true, rate: true, priceSet: { shopMoney: { amount: true } } },
  shippingLines: { title: true, originalPriceSet: { shopMoney: { amount: true } } },
} as const
```

### Special Flags

- `--order-id <gid>` for begin
- `--variant-id <gid>` for add-variant
- `--line-item-id <gid>` for quantity/discount operations
- `--discount-application-id <gid>` for discount removal
- `--shipping-line-id <gid>` for shipping operations
- `--quantity <int>` for add/set operations
- `--title <string>` for custom items
- `--price <Money>` for custom items
- `--staff-note <string>` for commit
- Standard flags

### Implementation Notes

- GID types: `CalculatedOrder`, `Order`
- Edit session is stateful - changes accumulate until commit
- CalculatedOrder has `stagedChanges` showing pending modifications
- Commit may trigger payment collection if amount increased
- Can add custom items (not product variants) for special charges
- Line item discounts can be added/updated during edit

---

## Router Updates

```typescript
import { returns } from './verbs/returns.js'
import { fulfillmentOrders } from './verbs/fulfillment-orders.js'
import { fulfillments } from './verbs/fulfillments.js'
import { subscriptionContracts } from './verbs/subscription-contracts.js'
import { subscriptionBilling } from './verbs/subscription-billing.js'
import { subscriptionDrafts } from './verbs/subscription-drafts.js'
import { orderEdit } from './verbs/order-edit.js'

// In router switch:
case 'returns': return returns(verb, args, ctx)
case 'fulfillment-orders': return fulfillmentOrders(verb, args, ctx)
case 'fulfillments': return fulfillments(verb, args, ctx)
case 'subscription-contracts': return subscriptionContracts(verb, args, ctx)
case 'subscription-billing': return subscriptionBilling(verb, args, ctx)
case 'subscription-drafts': return subscriptionDrafts(verb, args, ctx)
case 'order-edit': return orderEdit(verb, args, ctx)
```

---

## Testing Checklist

### Returns
- [ ] Full lifecycle: create → process → refund → close
- [ ] Customer request flow: request → approve/decline
- [ ] Calculate preview returns correct amounts
- [ ] Remove item from return works
- [ ] Reason definitions list correctly

### Fulfillment Orders
- [ ] State transitions are enforced correctly
- [ ] Request/accept flow for fulfillment services
- [ ] Hold and release operations
- [ ] Move to different location
- [ ] Split and merge operations
- [ ] Deadline setting works

### Fulfillments
- [ ] Create fulfillment from FO works
- [ ] Partial fulfillment (subset of lines)
- [ ] Tracking info updates
- [ ] Event creation for status updates

### Subscriptions
- [ ] Contract creation (draft → activate)
- [ ] Atomic create works
- [ ] Billing cycle charge
- [ ] Skip/unskip cycles
- [ ] Product change
- [ ] Pause/cancel/resume

### Order Edit
- [ ] Begin creates session
- [ ] Add variant calculates correctly
- [ ] Quantity changes reflected
- [ ] Discounts applied correctly
- [ ] Commit finalizes order
- [ ] Payment collection triggered if needed

---

## Consistency Requirements

Same as Phase 1 & 2, plus:

1. **Document state machines** in `--help` output for stateful resources

2. **Session-based operations** (order edit) should:
   - Return the session/calculated state after each operation
   - Allow chaining with `--quiet` (output only IDs)

3. **Indexed resources** (billing cycles) use `--cycle-index` not `--id`

4. **Polymorphic nested types** (delivery method, payment method) use inline fragments

5. **Workflow operations** should output meaningful status, not just success:
   ```
   Return RTN-12345 status: OPEN → CLOSED
   ```

---

## Definition of Done

- [ ] All 7 resource files implemented
- [ ] State machine transitions tested
- [ ] Session-based workflows tested (order edit)
- [ ] Polymorphic selections working
- [ ] Index-based lookups working (billing cycles)
- [ ] `.dev/cli-progress.md` updated
- [ ] No TypeScript errors
- [ ] Production-ready error messages
