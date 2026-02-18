# Phase 4: Complete Coverage Implementation Plan

**Objective:** Implement all remaining resources from the 2026-04 schema for 100% API coverage.
**Estimated Effort:** 20-30 days total
**Prerequisites:** Phases 1-3 complete

---

## Overview

Phase 4 covers 20+ remaining resources across several categories:
- **B2B / Enterprise:** Companies, Store Credit, Delegate Tokens
- **Storefront Customization:** Themes, Cart Transforms, Validation Functions
- **Analytics & Tracking:** Web Pixels, Server Pixels, Marketing Activities
- **Operations:** Bulk Operations, Inventory Items/Shipments, Carrier Services
- **Admin Tools:** Saved Searches, Script Tags, Translations
- **Specialized:** Product Variants (extended), Product Bundles, Checkout Branding, Delivery Profiles
- **Platform Integration:** App Billing, Shop Configuration, Events

---

## Resources in Phase 4

### Tier A: B2B & Enterprise (5-7 days)

| Resource | Operations | Complexity | Files |
|----------|-----------|------------|-------|
| Companies (B2B) | 25+ mutations, 5 queries | HIGH | `companies.ts`, `company-contacts.ts`, `company-locations.ts` |
| Store Credit | 2 mutations, 1 query | LOW | `store-credit.ts` |
| Delegate Access Tokens | 2 mutations | LOW | `delegate-tokens.ts` |

### Tier B: Storefront & Checkout (4-6 days)

| Resource | Operations | Complexity | Files |
|----------|-----------|------------|-------|
| Themes | 8 mutations, 2 queries | MEDIUM | `themes.ts` |
| Cart Transforms | 2 mutations, 1 query | LOW | `cart-transforms.ts` |
| Validation Functions | 3 mutations, 2 queries | MEDIUM | `validations.ts` |
| Checkout Branding | 1 mutation, 1 query | LOW | `checkout-branding.ts` |
| Delivery Profiles | 3 mutations, 2 queries | MEDIUM | `delivery-profiles.ts` |
| Delivery Customizations | 4 mutations, 2 queries | MEDIUM | `delivery-customizations.ts` |

### Tier C: Analytics & Marketing (3-4 days)

| Resource | Operations | Complexity | Files |
|----------|-----------|------------|-------|
| Web Pixels | 3 mutations, 1 query | LOW | `web-pixels.ts` |
| Server Pixels | 4 mutations, 1 query | LOW | `server-pixels.ts` |
| Marketing Activities | 7 mutations, 3 queries | MEDIUM | `marketing-activities.ts` |

### Tier D: Operations & Admin (4-5 days)

| Resource | Operations | Complexity | Files |
|----------|-----------|------------|-------|
| Bulk Operations | 3 mutations, 2 queries | MEDIUM | `bulk-operations.ts` |
| Inventory Items | 2 mutations, 2 queries | LOW | `inventory-items.ts` |
| Inventory Shipments | 8 mutations, 1 query | MEDIUM | `inventory-shipments.ts` |
| Carrier Services | 3 mutations, 2 queries | LOW | `carrier-services.ts` |
| Saved Searches | 3 mutations, per-resource queries | LOW | `saved-searches.ts` |
| Script Tags | 3 mutations, 2 queries | LOW | `script-tags.ts` |

### Tier E: Product Extensions (2-3 days)

| Resource | Operations | Complexity | Files |
|----------|-----------|------------|-------|
| Product Variants (extended) | 8 mutations, 3 queries | MEDIUM | Extend `product-variants.ts` |
| Product Bundles | 2 mutations | MEDIUM | Extend `products.ts` or `product-bundles.ts` |

### Tier F: Platform & Configuration (2-3 days)

| Resource | Operations | Complexity | Files |
|----------|-----------|------------|-------|
| App Billing | 6 mutations, 4 queries | MEDIUM | `app-billing.ts` |
| Shop Configuration | 5 mutations, 2 queries | LOW | `shop.ts` |
| Translations | 2 mutations, 3 queries | MEDIUM | `translations.ts` |
| Events | 0 mutations, 2 queries | LOW | `events.ts` |
| Shopify Functions | 0 mutations, 2 queries | LOW | `shopify-functions.ts` |

---

## Detailed Specifications

### 1. Companies (B2B)

**Files:**
- `src/cli/verbs/companies.ts`
- `src/cli/verbs/company-contacts.ts`
- `src/cli/verbs/company-locations.ts`

#### Companies Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop companies create` | `companyCreate` | `--input` |
| `shop companies get` | `company` | `--id` |
| `shop companies list` | `companies` | `--first`, `--query`, pagination |
| `shop companies count` | `companiesCount` | `--query?` |
| `shop companies update` | `companyUpdate` | `--id` + input |
| `shop companies delete` | `companyDelete` | `--id`, `--yes` |
| `shop companies bulk-delete` | `companiesDelete` | `--ids`, `--yes` |
| `shop companies assign-main-contact` | `companyAssignMainContact` | `--id`, `--contact-id` |
| `shop companies revoke-main-contact` | `companyRevokeMainContact` | `--id` |
| `shop companies assign-customer` | `companyAssignCustomerAsContact` | `--id`, `--customer-id` |

#### Company Contacts Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop company-contacts create` | `companyContactCreate` | `--company-id`, `--input` |
| `shop company-contacts get` | `companyContact` | `--id` |
| `shop company-contacts update` | `companyContactUpdate` | `--id` + input |
| `shop company-contacts delete` | `companyContactDelete` | `--id`, `--yes` |
| `shop company-contacts bulk-delete` | `companyContactsDelete` | `--ids`, `--yes` |
| `shop company-contacts assign-role` | `companyContactAssignRole` | `--id`, `--role-id`, `--location-id?` |
| `shop company-contacts assign-roles` | `companyContactAssignRoles` | `--id`, `--role-assignments` |
| `shop company-contacts revoke-role` | `companyContactRevokeRole` | `--id`, `--role-assignment-id` |
| `shop company-contacts revoke-roles` | `companyContactRevokeRoles` | `--id`, `--role-assignment-ids` |
| `shop company-contacts remove-from-company` | `companyContactRemoveFromCompany` | `--id` |
| `shop company-contacts send-welcome-email` | `companyContactSendWelcomeEmail` | `--id` |

#### Company Locations Operations

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop company-locations create` | `companyLocationCreate` | `--company-id`, `--input` |
| `shop company-locations get` | `companyLocation` | `--id` |
| `shop company-locations list` | `companyLocations` | `--first`, pagination |
| `shop company-locations update` | `companyLocationUpdate` | `--id` + input |
| `shop company-locations delete` | `companyLocationDelete` | `--id`, `--yes` |
| `shop company-locations bulk-delete` | `companyLocationsDelete` | `--ids`, `--yes` |
| `shop company-locations assign-address` | `companyLocationAssignAddress` | `--id`, `--address-type`, `--address` |
| `shop company-locations assign-roles` | `companyLocationAssignRoles` | `--id`, `--role-assignments` |
| `shop company-locations revoke-roles` | `companyLocationRevokeRoles` | `--id`, `--role-assignment-ids` |
| `shop company-locations assign-staff` | `companyLocationAssignStaffMembers` | `--id`, `--staff-member-ids` |
| `shop company-locations remove-staff` | `companyLocationRemoveStaffMembers` | `--id`, `--staff-member-ids` |
| `shop company-locations assign-tax-exemptions` | `companyLocationAssignTaxExemptions` | `--id`, `--exemptions` |
| `shop company-locations revoke-tax-exemptions` | `companyLocationRevokeTaxExemptions` | `--id`, `--exemptions` |
| `shop company-locations create-tax-registration` | `companyLocationCreateTaxRegistration` | `--id`, `--tax-id` |
| `shop company-locations revoke-tax-registration` | `companyLocationRevokeTaxRegistration` | `--id` |
| `shop company-locations update-tax-settings` | `companyLocationTaxSettingsUpdate` | `--id`, `--input` |

#### Company Selections

```typescript
const companySummarySelection = {
  id: true,
  name: true,
  externalId: true,
  mainContact: { id: true, customer: { displayName: true, email: true } },
  contactCount: true,
  locationCount: true,
  orderCount: true,
  createdAt: true,
} as const

const companyFullSelection = {
  ...companySummarySelection,
  note: true,
  contacts: {
    __args: { first: 10 },
    nodes: {
      id: true,
      isMainContact: true,
      customer: { id: true, displayName: true, email: true },
      roles: { __args: { first: 5 }, nodes: { id: true, name: true } },
    },
  },
  locations: {
    __args: { first: 10 },
    nodes: {
      id: true,
      name: true,
      billingAddress: { address1: true, city: true, countryCode: true },
      shippingAddress: { address1: true, city: true, countryCode: true },
    },
  },
  events: {
    __args: { first: 5 },
    nodes: { id: true, message: true, createdAt: true },
  },
} as const
```

---

### 2. Store Credit

**File:** `src/cli/verbs/store-credit.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop store-credit get` | `storeCreditAccount` | `--owner-id <customer-gid>` |
| `shop store-credit credit` | `storeCreditAccountCredit` | `--owner-id`, `--amount`, `--currency?` |
| `shop store-credit debit` | `storeCreditAccountDebit` | `--owner-id`, `--amount`, `--currency?` |

```typescript
const storeCreditAccountSelection = {
  id: true,
  balance: { amount: true, currencyCode: true },
  owner: {
    '... on Customer': { id: true, displayName: true, email: true },
    '... on CompanyLocation': { id: true, name: true },
  },
  transactions: {
    __args: { first: 10 },
    nodes: {
      __typename: true,
      id: true,
      amount: { amount: true, currencyCode: true },
      createdAt: true,
    },
  },
} as const
```

---

### 3. Delegate Access Tokens

**File:** `src/cli/verbs/delegate-tokens.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop delegate-tokens create` | `delegateAccessTokenCreate` | `--input` (scopes, expires) |
| `shop delegate-tokens destroy` | `delegateAccessTokenDestroy` | `--token <string>` |

```typescript
const delegateTokenSelection = {
  accessToken: true,
  createdAt: true,
  accessScopes: true,
} as const
```

---

### 4. Themes

**File:** `src/cli/verbs/themes.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop themes create` | `themeCreate` | `--input` (name, src, role) |
| `shop themes get` | `theme` | `--id` |
| `shop themes list` | `themes` | `--first`, `--roles?` |
| `shop themes update` | `themeUpdate` | `--id` + input |
| `shop themes delete` | `themeDelete` | `--id`, `--yes` |
| `shop themes duplicate` | `themeDuplicate` | `--id`, `--name?` |
| `shop themes publish` | `themePublish` | `--id` |
| `shop themes files-upsert` | `themeFilesUpsert` | `--id`, `--files` |
| `shop themes files-delete` | `themeFilesDelete` | `--id`, `--files` (paths) |
| `shop themes files-copy` | `themeFilesCopy` | `--id`, `--files` (src→dest mappings) |

```typescript
const themeSummarySelection = {
  id: true,
  name: true,
  role: true,
  processing: true,
  processingFailed: true,
  createdAt: true,
  updatedAt: true,
} as const

const themeFullSelection = {
  ...themeSummarySelection,
  prefix: true,
  files: {
    __args: { first: 20 },
    nodes: {
      filename: true,
      size: true,
      contentType: true,
      checksumMd5: true,
      updatedAt: true,
    },
  },
} as const
```

---

### 5. Cart Transforms

**File:** `src/cli/verbs/cart-transforms.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop cart-transforms create` | `cartTransformCreate` | `--function-id`, `--input` |
| `shop cart-transforms list` | `cartTransforms` | `--first`, pagination |
| `shop cart-transforms delete` | `cartTransformDelete` | `--id`, `--yes` |

```typescript
const cartTransformSelection = {
  id: true,
  functionId: true,
  blockOnFailure: true,
  metafield: { namespace: true, key: true, value: true },
} as const
```

---

### 6. Validation Functions (Checkout Validations)

**File:** `src/cli/verbs/validations.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop validations create` | `validationCreate` | `--function-id`, `--input` |
| `shop validations get` | `validation` | `--id` |
| `shop validations list` | `validations` | `--first`, pagination |
| `shop validations update` | `validationUpdate` | `--id` + input |
| `shop validations delete` | `validationDelete` | `--id`, `--yes` |

```typescript
const validationSelection = {
  id: true,
  functionId: true,
  title: true,
  enabled: true,
  blockOnFailure: true,
  merchantCode: true,
  shopifyFunction: { id: true, title: true, apiType: true },
} as const
```

---

### 7. Checkout Branding

**File:** `src/cli/verbs/checkout-branding.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop checkout-branding get` | `checkoutBranding` | `--profile-id` |
| `shop checkout-branding upsert` | `checkoutBrandingUpsert` | `--profile-id`, `--input` |

```typescript
const checkoutBrandingSelection = {
  customizations: {
    checkbox: { cornerRadius: true },
    control: { border: true, color: true, cornerRadius: true },
    favicon: { mediaImageId: true },
    global: { cornerRadius: true, typography: { letterCase: true, kerning: true } },
    header: { alignment: true, position: true, logo: { image: { mediaImageId: true } } },
    main: { backgroundImage: { mediaImageId: true } },
    orderSummary: { backgroundImage: { mediaImageId: true } },
    primaryButton: { background: true, blockPadding: true, border: true, cornerRadius: true },
    secondaryButton: { background: true, border: true, cornerRadius: true },
    textField: { border: true, typography: { font: true } },
  },
  designSystem: {
    colorPalette: {
      canvas: { accent: true, background: true, foreground: true },
      color1: { accent: true, background: true, foreground: true },
      color2: { accent: true, background: true, foreground: true },
    },
    cornerRadius: { base: true, small: true, large: true },
    typography: {
      primary: { base: { sources: true, weight: true }, bold: { sources: true, weight: true } },
      secondary: { base: { sources: true, weight: true }, bold: { sources: true, weight: true } },
      size: { base: true, ratio: true },
    },
  },
} as const
```

---

### 8. Delivery Profiles

**File:** `src/cli/verbs/delivery-profiles.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop delivery-profiles create` | `deliveryProfileCreate` | `--input` |
| `shop delivery-profiles get` | `deliveryProfile` | `--id` |
| `shop delivery-profiles list` | `deliveryProfiles` | `--first`, pagination |
| `shop delivery-profiles update` | `deliveryProfileUpdate` | `--id` + input |
| `shop delivery-profiles delete` | `deliveryProfileRemove` | `--id`, `--yes` |

```typescript
const deliveryProfileSummarySelection = {
  id: true,
  name: true,
  default: true,
  activeMethodDefinitionsCount: true,
  originLocationCount: true,
  productVariantsCount: { count: true, capped: true },
} as const

const deliveryProfileFullSelection = {
  ...deliveryProfileSummarySelection,
  profileLocationGroups: {
    locationGroup: {
      id: true,
      locations: { __args: { first: 10 }, nodes: { id: true, name: true } },
    },
    locationGroupZones: {
      __args: { first: 10 },
      nodes: {
        zone: { id: true, name: true, countries: { code: true, name: true } },
        methodDefinitions: {
          __args: { first: 10 },
          nodes: {
            id: true,
            name: true,
            active: true,
            rateProvider: {
              '... on DeliveryRateDefinition': { price: { amount: true } },
              '... on DeliveryParticipant': { participantServices: { name: true } },
            },
          },
        },
      },
    },
  },
} as const
```

---

### 9. Delivery Customizations

**File:** `src/cli/verbs/delivery-customizations.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop delivery-customizations create` | `deliveryCustomizationCreate` | `--function-id`, `--input` |
| `shop delivery-customizations get` | `deliveryCustomization` | `--id` |
| `shop delivery-customizations list` | `deliveryCustomizations` | `--first`, pagination |
| `shop delivery-customizations update` | `deliveryCustomizationUpdate` | `--id` + input |
| `shop delivery-customizations delete` | `deliveryCustomizationDelete` | `--id`, `--yes` |
| `shop delivery-customizations activate` | `deliveryCustomizationActivation` | `--id`, `--enabled <bool>` |

```typescript
const deliveryCustomizationSelection = {
  id: true,
  title: true,
  enabled: true,
  functionId: true,
  shopifyFunction: { id: true, title: true, apiType: true },
  metafield: { namespace: true, key: true, value: true },
} as const
```

---

### 10. Web Pixels

**File:** `src/cli/verbs/web-pixels.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop web-pixels create` | `webPixelCreate` | `--input` |
| `shop web-pixels get` | `webPixel` | `--id` |
| `shop web-pixels update` | `webPixelUpdate` | `--id` + input |
| `shop web-pixels delete` | `webPixelDelete` | `--id`, `--yes` |

```typescript
const webPixelSelection = {
  id: true,
  settings: true, // JSON configuration
} as const
```

---

### 11. Server Pixels

**File:** `src/cli/verbs/server-pixels.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop server-pixels get` | `serverPixel` | (no args, current app's pixel) |
| `shop server-pixels create` | `serverPixelCreate` | (implicit, via app configuration) |
| `shop server-pixels delete` | `serverPixelDelete` | |
| `shop server-pixels update-pubsub` | `pubSubServerPixelUpdate` | `--input` |
| `shop server-pixels update-eventbridge` | `eventBridgeServerPixelUpdate` | `--input` |

```typescript
const serverPixelSelection = {
  id: true,
  endpoint: {
    '... on WebhookPubSubEndpoint': { pubSubProject: true, pubSubTopic: true },
    '... on WebhookEventBridgeEndpoint': { arn: true },
  },
} as const
```

---

### 12. Marketing Activities

**File:** `src/cli/verbs/marketing-activities.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop marketing-activities create` | `marketingActivityCreate` | `--input` |
| `shop marketing-activities create-external` | `marketingActivityCreateExternal` | `--input` |
| `shop marketing-activities get` | `marketingActivity` | `--id` |
| `shop marketing-activities list` | `marketingActivities` | `--first`, pagination |
| `shop marketing-activities update` | `marketingActivityUpdate` | `--id` + input |
| `shop marketing-activities update-external` | `marketingActivityUpdateExternal` | `--id` + input |
| `shop marketing-activities upsert-external` | `marketingActivityUpsertExternal` | `--input` |
| `shop marketing-activities delete-external` | `marketingActivityDeleteExternal` | `--id` |
| `shop marketing-activities delete-all-external` | `marketingActivitiesDeleteAllExternal` | `--yes` |
| `shop marketing-activities create-engagement` | `marketingEngagementCreate` | `--activity-id`, `--input` |
| `shop marketing-activities delete-engagements` | `marketingEngagementsDelete` | `--activity-id`, `--input` |

```typescript
const marketingActivitySummarySelection = {
  id: true,
  title: true,
  activityListUrl: true,
  sourceAndMedium: true,
  status: true,
  statusBadgeType: true,
  budget: { currencyCode: true, total: { amount: true } },
  adSpend: { amount: true, currencyCode: true },
  createdAt: true,
  scheduledToEndAt: true,
} as const

const marketingActivityFullSelection = {
  ...marketingActivitySummarySelection,
  utmParameters: { campaign: true, medium: true, source: true },
  urlParameterValue: true,
  marketingChannelType: true,
  marketingEvent: { id: true, type: true, remoteId: true },
} as const
```

---

### 13. Bulk Operations

**File:** `src/cli/verbs/bulk-operations.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop bulk-operations run-query` | `bulkOperationRunQuery` | `--query <graphql>` |
| `shop bulk-operations run-mutation` | `bulkOperationRunMutation` | `--mutation <graphql>`, `--staged-upload-path?` |
| `shop bulk-operations get` | `bulkOperation` | `--id` |
| `shop bulk-operations list` | `bulkOperations` | `--first`, `--type?`, `--status?` |
| `shop bulk-operations current` | `currentBulkOperation` | `--type <QUERY|MUTATION>` |
| `shop bulk-operations cancel` | `bulkOperationCancel` | `--id` |

```typescript
const bulkOperationSelection = {
  id: true,
  type: true,
  status: true,
  errorCode: true,
  createdAt: true,
  completedAt: true,
  objectCount: true,
  fileSize: true,
  url: true,
  partialDataUrl: true,
  rootObjectCount: true,
  query: true,
} as const
```

**Special handling:** Bulk operations are async. The CLI should:
1. Start the operation
2. Output the operation ID
3. Optionally poll for completion with `--wait`

---

### 14. Inventory Items

**File:** `src/cli/verbs/inventory-items.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop inventory-items get` | `inventoryItem` | `--id` |
| `shop inventory-items list` | `inventoryItems` | `--first`, pagination |
| `shop inventory-items update` | `inventoryItemUpdate` | `--id` + input |

```typescript
const inventoryItemSummarySelection = {
  id: true,
  sku: true,
  tracked: true,
  requiresShipping: true,
  harmonizedSystemCode: true,
  countryCodeOfOrigin: true,
  provinceCodeOfOrigin: true,
  measurement: { weight: { value: true, unit: true } },
  variant: { id: true, displayName: true },
} as const

const inventoryItemFullSelection = {
  ...inventoryItemSummarySelection,
  unitCost: { amount: true, currencyCode: true },
  duplicateSkuCount: true,
  inventoryHistoryUrl: true,
  inventoryLevels: {
    __args: { first: 10 },
    nodes: {
      id: true,
      location: { id: true, name: true },
      quantities: { name: true, quantity: true },
    },
  },
  countryHarmonizedSystemCodes: {
    __args: { first: 10 },
    nodes: { countryCode: true, harmonizedSystemCode: true },
  },
} as const
```

---

### 15. Inventory Shipments

**File:** `src/cli/verbs/inventory-shipments.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop inventory-shipments create` | `inventoryShipmentCreate` | `--input` |
| `shop inventory-shipments create-in-transit` | `inventoryShipmentCreateInTransit` | `--input` |
| `shop inventory-shipments get` | `inventoryShipment` | `--id` |
| `shop inventory-shipments delete` | `inventoryShipmentDelete` | `--id`, `--yes` |
| `shop inventory-shipments add-items` | `inventoryShipmentAddItems` | `--id`, `--items` |
| `shop inventory-shipments remove-items` | `inventoryShipmentRemoveItems` | `--id`, `--line-item-ids` |
| `shop inventory-shipments update-quantities` | `inventoryShipmentUpdateItemQuantities` | `--id`, `--items` |
| `shop inventory-shipments mark-in-transit` | `inventoryShipmentMarkInTransit` | `--id` |
| `shop inventory-shipments receive` | `inventoryShipmentReceive` | `--id` |
| `shop inventory-shipments set-tracking` | `inventoryShipmentSetTracking` | `--id`, `--tracking` |

```typescript
const inventoryShipmentSummarySelection = {
  id: true,
  name: true,
  status: true,
  originLocation: { id: true, name: true },
  destinationLocation: { id: true, name: true },
  createdAt: true,
  expectedDeliveryDate: true,
  totalQuantity: true,
} as const

const inventoryShipmentFullSelection = {
  ...inventoryShipmentSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      inventoryItem: { id: true, sku: true },
      quantity: true,
    },
  },
  tracking: {
    company: true,
    number: true,
    url: true,
  },
} as const
```

---

### 16. Carrier Services

**File:** `src/cli/verbs/carrier-services.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop carrier-services create` | `carrierServiceCreate` | `--input` |
| `shop carrier-services get` | `carrierService` | `--id` |
| `shop carrier-services list` | `carrierServices` | `--first`, pagination |
| `shop carrier-services list-available` | `availableCarrierServices` | (shop-level query) |
| `shop carrier-services update` | `carrierServiceUpdate` | `--id` + input |
| `shop carrier-services delete` | `carrierServiceDelete` | `--id`, `--yes` |

```typescript
const carrierServiceSelection = {
  id: true,
  name: true,
  active: true,
  callbackUrl: true,
  supportsServiceDiscovery: true,
  formattedName: true,
} as const
```

---

### 17. Saved Searches

**File:** `src/cli/verbs/saved-searches.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop saved-searches create` | `savedSearchCreate` | `--resource-type`, `--input` |
| `shop saved-searches update` | `savedSearchUpdate` | `--id` + input |
| `shop saved-searches delete` | `savedSearchDelete` | `--id`, `--yes` |
| `shop saved-searches list-products` | `productSavedSearches` | `--first`, pagination |
| `shop saved-searches list-orders` | `orderSavedSearches` | `--first`, pagination |
| `shop saved-searches list-customers` | `customerSavedSearches` | `--first`, pagination |
| `shop saved-searches list-draft-orders` | `draftOrderSavedSearches` | `--first`, pagination |
| `shop saved-searches list-collections` | `collectionSavedSearches` | `--first`, pagination |

```typescript
const savedSearchSelection = {
  id: true,
  name: true,
  query: true,
  resourceType: true,
  searchTerms: true,
  filters: { key: true, value: true },
} as const
```

---

### 18. Script Tags

**File:** `src/cli/verbs/script-tags.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop script-tags create` | `scriptTagCreate` | `--input` |
| `shop script-tags get` | `scriptTag` | `--id` |
| `shop script-tags list` | `scriptTags` | `--first`, pagination |
| `shop script-tags update` | `scriptTagUpdate` | `--id` + input |
| `shop script-tags delete` | `scriptTagDelete` | `--id`, `--yes` |

```typescript
const scriptTagSelection = {
  id: true,
  src: true,
  displayScope: true,
  cache: true,
  createdAt: true,
  updatedAt: true,
} as const
```

---

### 19. Product Variants (Extended Operations)

**Extend:** `src/cli/verbs/product-variants.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop product-variants get` | `productVariant` | `--id` |
| `shop product-variants get-by-identifier` | `productVariantByIdentifier` | `--product-id`, `--sku?`, `--barcode?` |
| `shop product-variants list` | `productVariants` | `--first`, `--query?`, pagination |
| `shop product-variants count` | `productVariantsCount` | `--query?` |
| `shop product-variants bulk-create` | `productVariantsBulkCreate` | `--product-id`, `--input` |
| `shop product-variants bulk-update` | `productVariantsBulkUpdate` | `--product-id`, `--input` |
| `shop product-variants bulk-delete` | `productVariantsBulkDelete` | `--product-id`, `--variant-ids` |
| `shop product-variants bulk-reorder` | `productVariantsBulkReorder` | `--product-id`, `--positions` |
| `shop product-variants append-media` | `productVariantAppendMedia` | `--id`, `--media-ids` |
| `shop product-variants detach-media` | `productVariantDetachMedia` | `--id`, `--media-ids` |
| `shop product-variants join-selling-plans` | `productVariantJoinSellingPlanGroups` | `--id`, `--group-ids` |
| `shop product-variants leave-selling-plans` | `productVariantLeaveSellingPlanGroups` | `--id`, `--group-ids` |
| `shop product-variants update-relationships` | `productVariantRelationshipBulkUpdate` | `--input` |

---

### 20. Product Bundles

**Extend:** `src/cli/verbs/products.ts` (add bundle verbs)

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop products bundle-create` | `productBundleCreate` | `--product-id`, `--input` |
| `shop products bundle-update` | `productBundleUpdate` | `--product-id`, `--input` |

---

### 21. App Billing

**File:** `src/cli/verbs/app-billing.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop app-billing create-one-time` | `appPurchaseOneTimeCreate` | `--input` |
| `shop app-billing create-subscription` | `appSubscriptionCreate` | `--input` |
| `shop app-billing cancel-subscription` | `appSubscriptionCancel` | `--id` |
| `shop app-billing update-line-item` | `appSubscriptionLineItemUpdate` | `--id`, `--line-item-id`, `--input` |
| `shop app-billing extend-trial` | `appSubscriptionTrialExtend` | `--id`, `--days` |
| `shop app-billing create-usage-record` | `appUsageRecordCreate` | `--subscription-line-item-id`, `--input` |
| `shop app-billing get-installation` | `appInstallation` | `--id?` (defaults to current app) |
| `shop app-billing list-subscriptions` | (via appInstallation.activeSubscriptions) | |

---

### 22. Shop Configuration

**File:** `src/cli/verbs/shop.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop config get` | `shop` | (root query) |
| `shop config update-policy` | `shopPolicyUpdate` | `--input` |
| `shop config enable-locale` | `shopLocaleEnable` | `--locale` |
| `shop config disable-locale` | `shopLocaleDisable` | `--locale` |
| `shop config update-locale` | `shopLocaleUpdate` | `--locale`, `--input` |
| `shop config get-locales` | `shopLocales` | |

---

### 23. Translations

**File:** `src/cli/verbs/translations.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop translations get` | `translatableResource` | `--resource-id` |
| `shop translations list` | `translatableResources` | `--resource-type`, `--first`, pagination |
| `shop translations list-by-ids` | `translatableResourcesByIds` | `--resource-ids` |
| `shop translations register` | `translationsRegister` | `--resource-id`, `--translations` |
| `shop translations remove` | `translationsRemove` | `--resource-id`, `--translation-keys`, `--locales` |

---

### 24. Events

**File:** `src/cli/verbs/events.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop events get` | `event` | `--id` |
| `shop events list` | `events` | `--first`, `--query?`, pagination |
| `shop events count` | `eventsCount` | `--query?` |

---

### 25. Shopify Functions

**File:** `src/cli/verbs/shopify-functions.ts`

| CLI Command | GraphQL Operation | Notes |
|-------------|------------------|-------|
| `shop functions get` | `shopifyFunction` | `--id` |
| `shop functions list` | `shopifyFunctions` | `--first`, `--api-type?`, pagination |

```typescript
const shopifyFunctionSelection = {
  id: true,
  title: true,
  apiType: true,
  app: { id: true, title: true },
  appBridge: { detailsPath: true, createPath: true },
  useCreationUi: true,
} as const
```

---

## Router Updates

```typescript
// Phase 4 imports
import { companies } from './verbs/companies.js'
import { companyContacts } from './verbs/company-contacts.js'
import { companyLocations } from './verbs/company-locations.js'
import { storeCredit } from './verbs/store-credit.js'
import { delegateTokens } from './verbs/delegate-tokens.js'
import { themes } from './verbs/themes.js'
import { cartTransforms } from './verbs/cart-transforms.js'
import { validations } from './verbs/validations.js'
import { checkoutBranding } from './verbs/checkout-branding.js'
import { deliveryProfiles } from './verbs/delivery-profiles.js'
import { deliveryCustomizations } from './verbs/delivery-customizations.js'
import { webPixels } from './verbs/web-pixels.js'
import { serverPixels } from './verbs/server-pixels.js'
import { marketingActivities } from './verbs/marketing-activities.js'
import { bulkOperations } from './verbs/bulk-operations.js'
import { inventoryItems } from './verbs/inventory-items.js'
import { inventoryShipments } from './verbs/inventory-shipments.js'
import { carrierServices } from './verbs/carrier-services.js'
import { savedSearches } from './verbs/saved-searches.js'
import { scriptTags } from './verbs/script-tags.js'
import { appBilling } from './verbs/app-billing.js'
import { shopConfig } from './verbs/shop.js'
import { translations } from './verbs/translations.js'
import { events } from './verbs/events.js'
import { shopifyFunctions } from './verbs/shopify-functions.js'

// Router switch additions
case 'companies': return companies(verb, args, ctx)
case 'company-contacts': return companyContacts(verb, args, ctx)
case 'company-locations': return companyLocations(verb, args, ctx)
case 'store-credit': return storeCredit(verb, args, ctx)
case 'delegate-tokens': return delegateTokens(verb, args, ctx)
case 'themes': return themes(verb, args, ctx)
case 'cart-transforms': return cartTransforms(verb, args, ctx)
case 'validations': return validations(verb, args, ctx)
case 'checkout-branding': return checkoutBranding(verb, args, ctx)
case 'delivery-profiles': return deliveryProfiles(verb, args, ctx)
case 'delivery-customizations': return deliveryCustomizations(verb, args, ctx)
case 'web-pixels': return webPixels(verb, args, ctx)
case 'server-pixels': return serverPixels(verb, args, ctx)
case 'marketing-activities': return marketingActivities(verb, args, ctx)
case 'bulk-operations': return bulkOperations(verb, args, ctx)
case 'inventory-items': return inventoryItems(verb, args, ctx)
case 'inventory-shipments': return inventoryShipments(verb, args, ctx)
case 'carrier-services': return carrierServices(verb, args, ctx)
case 'saved-searches': return savedSearches(verb, args, ctx)
case 'script-tags': return scriptTags(verb, args, ctx)
case 'app-billing': return appBilling(verb, args, ctx)
case 'config': return shopConfig(verb, args, ctx)
case 'translations': return translations(verb, args, ctx)
case 'events': return events(verb, args, ctx)
case 'functions': return shopifyFunctions(verb, args, ctx)
```

---

## Coverage Summary

### After Phase 4 Completion

| Category | Resources | Operations | Status |
|----------|-----------|------------|--------|
| **Implemented (Phase 1-3)** | 40+ | ~250 | ✅ |
| **Phase 4 New** | 25+ | ~150 | 🔲 |
| **Total** | ~65 | ~400 | 100% coverage |

### Final Operation Count

| Type | Count |
|------|-------|
| Queries (read) | ~190 |
| Mutations (write) | ~210 |
| **Total Operations** | ~400 |

---

## Consistency Requirements

Same as Phases 1-3, plus:

1. **Read-only resources** (Events, Shopify Functions) should clearly document that mutations are not available

2. **App-scoped resources** (App Billing, Server Pixels) note that they operate on the current app context

3. **Complex nested resources** (Companies) should have clear parent-child CLI patterns:
   ```
   shop company-contacts create --company-id <gid> --input ...
   ```

4. **Bulk operations** should support `--wait` flag for polling until completion

5. **Polymorphic responses** (Store Credit owner, Server Pixel endpoint) use inline fragments

---

## Testing Checklist

### Tier A (B2B)
- [ ] Company full lifecycle: create → add contacts → add locations → assign roles → delete
- [ ] Store credit: get balance, credit, debit, verify transaction history
- [ ] Delegate tokens: create with scopes, use token, destroy

### Tier B (Storefront)
- [ ] Theme: create, upload files, publish, delete
- [ ] Cart transforms: create from function, test, delete
- [ ] Validations: create, enable/disable, delete
- [ ] Checkout branding: upsert colors, typography, logo

### Tier C (Analytics)
- [ ] Web pixel: create, configure, delete
- [ ] Marketing activities: create external, track engagement, delete

### Tier D (Operations)
- [ ] Bulk operation: run query, poll for completion, download results
- [ ] Inventory items: update SKU, harmonized codes, weights
- [ ] Carrier services: create, activate, delete

### Tier E (Products)
- [ ] Product variants: bulk create, reorder, media attachment
- [ ] Product bundles: create bundle from existing products

### Tier F (Platform)
- [ ] App billing: create subscription, usage records
- [ ] Translations: register, verify, remove

---

## Definition of Done

- [ ] All 25+ resource files implemented
- [ ] All operations tested
- [ ] Nested resource patterns documented in `--help`
- [ ] Async operations (bulk) support `--wait`
- [ ] `.dev/cli-progress.md` shows 100% coverage
- [ ] No TypeScript errors
- [ ] Full mutation coverage: ~400+ operations
- [ ] Full query coverage: ~190+ queries
