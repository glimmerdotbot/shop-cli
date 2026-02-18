# Phase 1: Quick Wins Implementation Plan

**Objective:** Add 4 high-impact, low-complexity resources to reach ~75% popular API coverage.
**Estimated Effort:** 4-6 days total
**Prerequisites:** None (these are independent resources)

---

## Resources in Phase 1

| Resource | Operations | Complexity | Impact |
|----------|-----------|------------|--------|
| Gift Cards | 7 mutations + 4 queries | LOW | HIGH (retail/loyalty) |
| Locations | 7 mutations + 3 queries | LOW | HIGH (multi-location) |
| Fulfillment Services | 3 mutations + 1 query | LOW | MEDIUM (3PL integrations) |
| Payment Terms | 4 mutations + 1 query | LOW | MEDIUM (B2B invoicing) |

---

## 1. Gift Cards

**File:** `src/cli/verbs/gift-cards.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop gift-cards create` | `giftCardCreate` | `--input` / `--set` |
| `shop gift-cards get` | `giftCard` | `--id` |
| `shop gift-cards list` | `giftCards` | `--first`, `--query`, pagination |
| `shop gift-cards count` | `giftCardsCount` | `--query?` |
| `shop gift-cards update` | `giftCardUpdate` | `--id` + input |
| `shop gift-cards credit` | `giftCardCredit` | `--id`, `--credit-amount` |
| `shop gift-cards debit` | `giftCardDebit` | `--id`, `--debit-amount` |
| `shop gift-cards deactivate` | `giftCardDeactivate` | `--id` |
| `shop gift-cards notify-customer` | `giftCardSendNotificationToCustomer` | `--id` |
| `shop gift-cards notify-recipient` | `giftCardSendNotificationToRecipient` | `--id` |
| `shop gift-cards config` | `giftCardConfiguration` | (no args) |

### Selections

```typescript
// Summary selection
const giftCardSummarySelection = {
  id: true,
  displayValue: true,
  balance: { amount: true, currencyCode: true },
  initialValue: { amount: true, currencyCode: true },
  lastCharacters: true,
  expiresOn: true,
  enabled: true,
  createdAt: true,
} as const

// Full selection (adds customer, order, note, etc.)
const giftCardFullSelection = {
  ...giftCardSummarySelection,
  customer: { id: true, displayName: true, email: true },
  order: { id: true, name: true },
  note: true,
  maskedCode: true,
  recipient: { id: true, firstName: true, lastName: true, email: true },
} as const
```

### Special Flags

- `--credit-amount <Money>` for `credit` verb
- `--debit-amount <Money>` for `debit` verb
- Standard `--id`, `--input`, `--set`, `--set-json`, `--view`, `--format`, etc.

### Implementation Notes

- Use `_shared.ts` helpers: `requireId`, `parseFirst`, `parseCsv`
- Pattern B for raw format handling: `printJson(result.XXX, ctx.format !== 'raw')`
- GID type: `GiftCard`
- `credit` and `debit` accept a `creditAmount`/`debitAmount` input object

---

## 2. Locations

**File:** `src/cli/verbs/locations.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop locations add` | `locationAdd` | `--input` / `--set` |
| `shop locations get` | `location` | `--id` |
| `shop locations list` | `locations` | `--first`, pagination |
| `shop locations count` | `locationsCount` | |
| `shop locations edit` | `locationEdit` | `--id` + input |
| `shop locations delete` | `locationDelete` | `--id`, `--yes` |
| `shop locations activate` | `locationActivate` | `--id` |
| `shop locations deactivate` | `locationDeactivate` | `--id`, `--destination-location-id?` |
| `shop locations enable-local-pickup` | `locationLocalPickupEnable` | `--id` |
| `shop locations disable-local-pickup` | `locationLocalPickupDisable` | `--id` |

### Selections

```typescript
const locationSummarySelection = {
  id: true,
  name: true,
  address: {
    address1: true,
    city: true,
    provinceCode: true,
    countryCode: true,
    zip: true,
  },
  isActive: true,
  fulfillsOnlineOrders: true,
  hasActiveInventory: true,
  localPickupSettingsV2: { instructions: true, pickupTime: true },
} as const

const locationFullSelection = {
  ...locationSummarySelection,
  address: {
    address1: true,
    address2: true,
    city: true,
    province: true,
    provinceCode: true,
    country: true,
    countryCode: true,
    zip: true,
    phone: true,
    formatted: true,
  },
  fulfillmentService: { id: true, serviceName: true },
  shipsInventory: true,
  suggestedAddresses: { address1: true, city: true, zip: true },
} as const
```

### Special Flags

- `--destination-location-id <gid>` for `deactivate` (move inventory to another location)
- Standard flags

### Implementation Notes

- GID type: `Location`
- `locationAdd` returns `location` field (not `locationAddResult`)
- `locationEdit` takes `id` separate from `input`
- `locationDelete` has `destinationLocationId` option for inventory migration

---

## 3. Fulfillment Services

**File:** `src/cli/verbs/fulfillment-services.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop fulfillment-services create` | `fulfillmentServiceCreate` | `--input` / `--set` |
| `shop fulfillment-services get` | `fulfillmentService` | `--id` |
| `shop fulfillment-services list` | (via shop.fulfillmentServices) | No direct query; use shop query |
| `shop fulfillment-services update` | `fulfillmentServiceUpdate` | `--id` + input |
| `shop fulfillment-services delete` | `fulfillmentServiceDelete` | `--id`, `--yes` |

### Selections

```typescript
const fulfillmentServiceSummarySelection = {
  id: true,
  serviceName: true,
  handle: true,
  fulfillmentOrdersOptIn: true,
  inventoryManagement: true,
  trackingSupport: true,
  location: { id: true, name: true },
} as const

const fulfillmentServiceFullSelection = {
  ...fulfillmentServiceSummarySelection,
  callbackUrl: true,
  permitsSkuSharing: true,
  productBased: true,
  shippingMethods: { code: true, label: true },
} as const
```

### Implementation Notes

- GID type: `FulfillmentService`
- No `fulfillmentServices` root query - must list via `shop { fulfillmentServices { ... } }`
- Create mutation signature: `fulfillmentServiceCreate(name, callbackUrl, trackingSupport, ...)`

---

## 4. Payment Terms

**File:** `src/cli/verbs/payment-terms.ts`

### Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop payment-terms create` | `paymentTermsCreate` | `--reference-id <order-gid>`, `--input` |
| `shop payment-terms update` | `paymentTermsUpdate` | `--id` + input |
| `shop payment-terms delete` | `paymentTermsDelete` | `--id`, `--yes` |
| `shop payment-terms send-reminder` | `paymentReminderSend` | `--id` |
| `shop payment-terms templates` | `paymentTermsTemplates` | (no args, list templates) |

### Selections

```typescript
const paymentTermsSummarySelection = {
  id: true,
  paymentTermsName: true,
  paymentTermsType: true,
  dueInDays: true,
  overdue: true,
  paymentSchedules: {
    nodes: {
      id: true,
      issuedAt: true,
      dueAt: true,
      amount: { amount: true, currencyCode: true },
      completedAt: true,
    },
  },
} as const

const paymentTermsTemplateSelection = {
  id: true,
  name: true,
  paymentTermsType: true,
  dueInDays: true,
  description: true,
} as const
```

### Special Flags

- `--reference-id <order-gid>` for `create` (attach to an order)
- `--template-id <template-gid>` for using a template
- Standard flags

### Implementation Notes

- GID type: `PaymentTerms`
- No direct `paymentTerms` or `paymentTermsList` queries - terms are embedded in orders
- Create requires `referenceId` (the order GID)
- `paymentTermsTemplates` is a root query that returns available templates

---

## Router Updates

Add to `src/cli/router.ts`:

```typescript
import { giftCards } from './verbs/gift-cards.js'
import { locations } from './verbs/locations.js'
import { fulfillmentServices } from './verbs/fulfillment-services.js'
import { paymentTerms } from './verbs/payment-terms.js'

// In router switch:
case 'gift-cards': return giftCards(verb, args, ctx)
case 'locations': return locations(verb, args, ctx)
case 'fulfillment-services': return fulfillmentServices(verb, args, ctx)
case 'payment-terms': return paymentTerms(verb, args, ctx)
```

---

## Testing Checklist

For each resource:
- [ ] `--help` at resource level shows all verbs
- [ ] `--help` at verb level shows all flags
- [ ] `create` with `--input @file.json` works
- [ ] `create` with `--set key=value` works
- [ ] `get --id <gid>` works
- [ ] `list --first 5` works (where applicable)
- [ ] `update --id <gid> --set key=value` works
- [ ] `delete --id <gid>` requires `--yes`
- [ ] `--dry-run` shows GraphQL without executing
- [ ] `--view summary|full|raw` outputs correctly
- [ ] `--format json|table` outputs correctly
- [ ] `--select field.path` works
- [ ] Error messages are clear for missing required flags

---

## Consistency Requirements (Post-Consistency-Task Shape)

All new handlers MUST:

1. **Import from `_shared.ts`:**
   ```typescript
   import { requireId, parseFirst, parseCsv, parseIds } from './_shared.js'
   ```

2. **Use Pattern B for raw format:**
   ```typescript
   printJson(result.XXX, ctx.format !== 'raw')
   ```

3. **Include `full` selection even if same as summary:**
   ```typescript
   const xxxFullSelection = { ...xxxSummarySelection } as const
   ```

4. **No redundant GID coercion** (don't call `coerceGid` after `requireId`)

5. **Consistent help text format:**
   ```typescript
   'Usage: shop <resource> <verb> [flags]\n\n' +
   'Verbs:\n' +
   '  create   Create a <resource>\n' +
   '  get      Get a <resource> by ID\n' +
   // etc.
   ```

6. **Standard userErrors selection:**
   ```typescript
   userErrors: { field: true, message: true }
   ```

---

## Definition of Done

- [ ] All 4 resources implemented with full CRUD
- [ ] All operations tested manually
- [ ] `--help` complete for all verbs
- [ ] `.dev/cli-progress.md` updated with new commands
- [ ] No TypeScript errors
- [ ] Code follows consistency requirements above
