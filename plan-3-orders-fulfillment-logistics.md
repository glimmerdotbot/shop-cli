# Plan 3 — Orders, Fulfillment & Logistics (53 root fields)

Decisions:
- New surfaces should nearly always be new resources (not bolted onto existing ones).
- Prefer new verbs over overloading existing verbs with extra flags.

Goal: implement the missing Admin API (2026-04) operations for orders, fulfillment, inventory, delivery/logistics, checkout branding/profile, and event-bridge webhook subscriptions.

Scope (operations to cover)

Queries (20):
- `assignedFulfillmentOrders`
- `checkoutBranding`
- `checkoutProfile`
- `checkoutProfiles`
- `deletionEvents`
- `deliveryPromiseProvider`
- `inventoryLevel`
- `inventoryProperties`
- `job`
- `locationByIdentifier`
- `locationsAvailableForDeliveryProfiles`
- `locationsAvailableForDeliveryProfilesConnection`
- `manualHoldsFulfillmentOrders`
- `orderByIdentifier`
- `orderEditSession`
- `orderPaymentStatus`
- `pendingOrdersCount`
- `returnableFulfillment`
- `reverseDelivery`
- `reverseFulfillmentOrder`

Mutations (33):
- `bulkOperationCancel`
- `checkoutBrandingUpsert`
- `deliveryCustomizationActivation`
- `deliveryPromiseProviderUpsert`
- `deliverySettingUpdate`
- `deliveryShippingOriginAssign`
- `draftOrderBulkDelete`
- `eventBridgeWebhookSubscriptionCreate`
- `eventBridgeWebhookSubscriptionUpdate`
- `fulfillmentCreate`
- `fulfillmentServiceCreate`
- `fulfillmentServiceUpdate`
- `fulfillmentTrackingInfoUpdate`
- `fulfillmentTrackingInfoUpdateV2`
- `inventoryActivate`
- `inventoryBulkToggleActivation`
- `inventoryDeactivate`
- `inventorySetOnHandQuantities`
- `inventorySetScheduledChanges`
- `inventoryTransferSetItems`
- `locationLocalPickupEnable`
- `orderCapture`
- `orderCreateManualPayment`
- `orderCustomerRemove`
- `orderCustomerSet`
- `orderEditRemoveLineItemDiscount`
- `orderInvoiceSend`
- `orderOpen`
- `orderRiskAssessmentCreate`
- `returnLineItemRemoveFromReturn`
- `reverseDeliveryCreateWithShipping`
- `reverseDeliveryShippingUpdate`
- `reverseFulfillmentOrderDispose`

Proposed CLI resources / verbs

- `orders`
  - Lookup: `by-identifier`
  - Payment/status: `payment-status`, `capture`, `create-manual-payment`, `invoice-send`, `open`
  - Customer association: `customer-set`, `customer-remove`
  - Risk: `risk-assessment-create`
  - Counts: `pending-count`

- `order-edit`
  - `session`
  - `remove-line-item-discount`

- `fulfillments`
  - `create`
  - `tracking-update`, `tracking-update-v2`

- `fulfillment-services`
  - `create`, `update`

- `fulfillment-orders`
  - `assigned`
  - `manual-holds`

- `reverse-deliveries` (new resource; separate from `returns`)
  - `get` (`reverseDelivery`)
  - `create-with-shipping`
  - `shipping-update`

- `reverse-fulfillment-orders` (new resource)
  - `get` (`reverseFulfillmentOrder`)
  - `dispose`

- `returnable-fulfillments` (new resource; query-only “surface”)
  - `get` (`returnableFulfillment`)

- `returns`
  - `line-item-remove` (`returnLineItemRemoveFromReturn`)

- `inventory`
  - Activation: `activate`, `deactivate`, `bulk-toggle-activation`
  - On-hand/scheduled: `set-on-hand-quantities`, `set-scheduled-changes`
  - Transfers: `transfer-set-items`
  - Queries: `level`, `properties`

- `delivery-promises` (new resource; treat promise provider ops as their own surface)
  - `provider` (query), `provider-upsert` (mutation)

- `delivery-settings` (new resource)
  - `setting-update`
  - `shipping-origin-assign`

- `delivery-customizations`
  - `activation` (`deliveryCustomizationActivation`)

- `delivery-profile-locations` (new resource; dedicated to “available locations” queries)
  - `available` (`locationsAvailableForDeliveryProfiles`)
  - `available-connection` (`locationsAvailableForDeliveryProfilesConnection`)

- `locations`
  - Lookup: `by-identifier`
  - Local pickup: `local-pickup-enable`

- `bulk-operations`
  - `cancel` (`bulkOperationCancel`)
  - `job` (query `job`, if it maps cleanly via args)

- `checkout-branding`
  - `get` (`checkoutBranding`)
  - `upsert` (`checkoutBrandingUpsert`)

- `checkout-profiles` (new resource)
  - `get` (`checkoutProfile`)
  - `list` (`checkoutProfiles`)

- `webhooks`
  - `event-bridge-create`, `event-bridge-update`

- `events`
  - `deletion-events` (`deletionEvents`)

Implementation outline

1. Add new resources verb files (reverse-deliveries, reverse-fulfillment-orders, checkout-profiles, etc).
2. Wire new resources:
   - `src/cli/router.ts`
   - `src/cli/introspection/resources.ts`
   - `src/cli/help/registry.ts`
3. Implement remaining verbs in existing files:
   - `src/cli/verbs/orders.ts`
   - `src/cli/verbs/order-edit.ts`
   - `src/cli/verbs/fulfillments.ts`
   - `src/cli/verbs/fulfillment-services.ts`
   - `src/cli/verbs/fulfillment-orders.ts`
   - `src/cli/verbs/inventory.ts`
   - `src/cli/verbs/locations.ts`
   - `src/cli/verbs/returns.ts`
   - `src/cli/verbs/checkout-branding.ts`
   - `src/cli/verbs/bulk-operations.ts`
   - `src/cli/verbs/webhooks.ts`
   - `src/cli/verbs/events.ts`
4. Update/regen GraphQL test manifest + verify:
   - `npm run test:graphql:manifest`
   - `npm run typecheck`
   - `npm run check:help`
   - `npm run test`
   - `npx tsx scripts/report-admin-api-coverage.ts` drops missing root fields by 53.

