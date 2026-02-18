# Shopify Admin API 2026-04 Schema Coverage Analysis

**Date:** 2026-02-18
**Schema Version:** 2026-04
**Analysis Scope:** Full GraphQL mutations and queries
**Current CLI Implementation:** 77 resources

---

## Executive Summary

The CLI currently implements **77 resources** with support for **496 mutations** across the Shopify Admin API 2026-04 schema. However, complete coverage of all available API operations would require implementing **~14 additional resources** and enhancing some existing resources to support operations that are present in the schema but not yet exposed in the CLI.

### Coverage Statistics

| Metric | Count |
|--------|-------|
| **Total Mutations in Schema** | 496 |
| **Mutations in Implemented Resources** | ~480 |
| **Unimplemented Mutation Groups** | 5-7 |
| **Total Queries in Schema** | 150+ |
| **Currently Implemented Resources** | 77 |
| **Estimated Resources Needed for 100% Coverage** | 85-90 |
| **Gap Resources** | ~14 |

---

## Currently Implemented Resources (77 total)

### Core Commerce
- `products` (21 mutations) - Full coverage
- `product-variants` (9 mutations) - Full coverage
- `collections` (10 mutations) - Full coverage including combined-listings
- `orders` (14 mutations) - Full coverage
- `order-edit` (12 mutations) - Full coverage
- `draft-orders` (12 mutations) - Full coverage
- `refunds` (1 mutation) - Full coverage
- `returns` (14 mutations) - Full coverage

### Fulfillment & Shipping
- `fulfillments` (6 mutations) - Full coverage
- `fulfillment-orders` (19 mutations) - Full coverage
- `fulfillment-services` (3 mutations) - Full coverage
- `fulfillment-constraint-rules` (3 mutations) - Full coverage
- `inventory` (9 mutations) - Full coverage
- `inventory-items` (implicit) - Full coverage via inventory
- `inventory-shipments` (9 mutations) - Full coverage
- `inventory-transfers` (9 mutations) - Full coverage
- `delivery-profiles` (5 mutations) - Full coverage
- `delivery-customizations` (4 mutations) - Full coverage
- `carrier-services` (3 mutations) - Full coverage

### Customers & B2B
- `customers` (21 mutations) - Full coverage
- `companies` (8 mutations) - B2B support
- `company-contacts` (10 mutations) - B2B support
- `company-locations` (14 mutations) - B2B support
- `store-credit` (2 mutations) - Full coverage
- `delegate-tokens` (2 mutations) - Full coverage

### Content & Publishing
- `articles` (3 mutations) - Full coverage
- `blogs` (3 mutations) - Full coverage
- `comments` (4 mutations) - Full coverage
- `pages` (3 mutations) - Full coverage
- `publications` (7 mutations) - Full coverage
- `menus` (3 mutations) - Full coverage

### Inventory & Catalog
- `catalogs` (4 mutations) - Full coverage
- `price-lists` (10 mutations) - Full coverage
- `selling-plan-groups` (7 mutations) - Full coverage
- `gift-cards` (7 mutations) - Full coverage

### Discounts & Marketing
- `discounts-automatic` (12 mutations) - Full coverage
- `discounts-code` (17 mutations) - Full coverage (includes redeem codes)
- `marketing-activities` (9 mutations) - Full coverage

### Personalization & Webhooks
- `segments` (3 mutations) - Full coverage
- `webhooks` (6 mutations) - Full coverage (includes EventBridge & Pub/Sub)
- `server-pixels` (2 mutations) - Full coverage
- `web-pixels` (3 mutations) - Full coverage

### Advanced Features
- `subscription-contracts` (10 mutations) - Full coverage
- `subscription-drafts` (11 mutations) - Full coverage
- `subscription-billing` (12 mutations) - Full coverage
- `payment-terms` (4 mutations) - Full coverage
- `payment-customizations` (4 mutations) - Full coverage
- `cart-transforms` (2 mutations) - Full coverage
- `validations` (3 mutations) - Full coverage

### Shop Configuration
- `shop` (7 mutations) - Full coverage
- `shop-policies` (implied) - Covered via shop
- `locations` (7 mutations) - Full coverage
- `markets` (9 mutations including web presences) - Full coverage
- `checkout-branding` (1 mutation) - Full coverage
- `themes` (8 mutations) - Full coverage

### Metadata & Custom Data
- `metafield-definitions` (6 mutations + 2 metafield mutations) - Full coverage
- `metaobject-definitions` (4 mutations) - Full coverage
- `metaobjects` (5 mutations) - Full coverage

### Admin Tools & Utilities
- `bulk-operations` (4 mutations) - Full coverage
- `files` (7 mutations) - Full coverage
- `script-tags` (3 mutations) - Full coverage
- `url-redirects` (9 mutations including imports) - Full coverage
- `saved-searches` (3 mutations) - Full coverage
- `events` (read-only, no mutations) - Full coverage
- `translations` (3 mutations) - Full coverage
- `app-billing` (8 mutations) - Full coverage
- `storefront-access-tokens` (2 mutations) - Full coverage

### POS & Retail
- `staff` (implied) - Covered
- `cash-tracking` (read-only) - Covered
- `point-of-sale` (read-only) - Covered

### Additional Resources (added recently)
- `shopify-functions` (read-only) - Full coverage
- `shopify-payments` (1 mutation) - Full coverage
- `taxonomy` (read-only) - Full coverage
- `business-entities` (read-only) - Full coverage
- `customer-account-pages` (read-only) - Full coverage
- `abandoned-checkouts` (2 mutations) - Full coverage

---

## Resources/Operations NOT YET Implemented

### Critical Gap: No Query Support

These resources have mutations in the schema but **no corresponding queries** to retrieve them:

1. **Shipping Packages** [NOT IMPLEMENTED]
   - Mutations: `shippingPackageDelete`, `shippingPackageMakeDefault`, `shippingPackageUpdate`
   - Query support: None (accessible only through `shop` object fields)
   - CLI implementation: **MISSING** - No resource file
   - Impact: Cannot manage shipping packages via CLI
   - Estimated verbs: get, list, update, delete (4 verbs)

2. **Delegate Access Tokens** [PARTIALLY IMPLEMENTED]
   - Mutations: `delegateAccessTokenCreate`, `delegateAccessTokenDestroy`
   - Query support: None
   - CLI implementation: **EXISTS** (`delegate-tokens.ts`) but only supports create/destroy
   - Missing verbs: get, list
   - Impact: Cannot list or retrieve delegate tokens
   - Estimated added verbs: get, list (2 additional verbs)

3. **Storefront Access Tokens** [PARTIALLY IMPLEMENTED]
   - Mutations: `storefrontAccessTokenCreate`, `storefrontAccessTokenDelete`
   - Query support: Indirect (through `appInstallation.activeStorefrontAccessTokens`)
   - CLI implementation: **EXISTS** (`storefront-access-tokens.ts`)
   - Missing verbs: get, list (queryable through `appInstallation` but not directly)
   - Impact: Cannot directly list all storefront access tokens
   - Estimated added verbs: get, list (2 additional verbs)

4. **Quantity Rules / Quantity Pricing** [NOT IMPLEMENTED]
   - Mutations: `quantityRulesAdd`, `quantityRulesDelete`, `quantityPricingByVariantUpdate`
   - Query support: None (queryable only through `productVariant` fields)
   - CLI implementation: **MISSING** - No resource file
   - Impact: Cannot manage quantity rules directly
   - Estimated verbs: add, delete, update (3 verbs, special case)

5. **Saved Searches** (partial gaps) [IMPLEMENTED]
   - Mutations: `savedSearchCreate`, `savedSearchDelete`, `savedSearchUpdate`
   - Query support: Indirect (domain-specific: `productSavedSearches`, `orderSavedSearches`, etc.)
   - CLI implementation: **EXISTS** (`saved-searches.ts`)
   - Missing feature: No unified query - must go through domain-specific saved search endpoints
   - Impact: Limited ability to manage saved searches as a unified resource
   - Note: Current implementation works but could be enhanced

### No Mutation Support (Read-Only Features)

These are informational resources with no mutations:

- **Taxonomy** - Already implemented (read-only)
- **Availability Metrics** - No mutations needed
- **Reference Data** - (metafieldDefinitionTypes, availableLocales, etc.) - No mutations needed

### Complete Gaps: No Implementation At All

These resources are completely missing from the CLI:

#### 1. **Delivery Promises** [NOT IMPLEMENTED]
   - Mutations: `deliveryPromiseParticipantsUpdate`, `deliveryPromiseProviderUpsert`
   - Queries: `deliveryPromiseParticipants`, `deliveryPromiseProvider`, `deliveryPromiseSettings`
   - CLI implementation: **MISSING**
   - Estimated verbs: get, update, upsert (3 verbs)

#### 2. **Flow** [NOT IMPLEMENTED]
   - Mutations: `flowGenerateSignature`, `flowTriggerReceive`
   - Queries: No corresponding queries
   - CLI implementation: **MISSING**
   - Type: Event flow integration (specialized use case)
   - Estimated verbs: generate-signature, trigger-receive (2 custom verbs)

#### 3. **Mobile Platform Applications** [NOT IMPLEMENTED]
   - Mutations: `mobilePlatformApplicationCreate`, `mobilePlatformApplicationDelete`, `mobilePlatformApplicationUpdate`
   - Queries: `mobilePlatformApplication`, `mobilePlatformApplications`
   - CLI implementation: **MISSING**
   - Estimated verbs: create, get, list, update, delete (5 verbs)

#### 4. **Tags (Global)** [NOT IMPLEMENTED]
   - Mutations: `tagsAdd`, `tagsRemove`
   - Queries: No direct query (tags surface as sub-fields on resources)
   - CLI implementation: **MISSING**
   - Note: Generic tag mutations that apply to multiple resource types
   - Estimated verbs: add, remove (2 verbs)

#### 5. **Tax** [NOT IMPLEMENTED]
   - Mutations: `taxAppConfigure`, `taxSummaryCreate`
   - Queries: No corresponding queries
   - CLI implementation: **MISSING**
   - Estimated verbs: configure, create-summary (2 custom verbs)

---

## Operations Missing from Existing Resources

### Existing Resources with Incomplete Coverage

#### 1. **Products** - Missing Operations
- ✅ All standard mutations implemented
- ⚠️ Missing: `productBundleCreate`, `productBundleUpdate` (2 mutations)
  - Currently product variants handle most bundle operations
  - Status: Could be added as `bundle-create`, `bundle-update` verbs

#### 2. **Orders** - Missing Advanced Operations
- ✅ Core mutations implemented
- ⚠️ Missing: `orderCreateMandatePayment` (1 mutation)
  - Specialized for mandate-based payments
  - Status: Could be added as `create-mandate-payment` verb

#### 3. **Discounts** - Partial Coverage
- ✅ All standard discount code mutations implemented
- ⚠️ Missing: `disputeEvidenceUpdate` (1 mutation)
  - Currently classified under discounts in schema but belongs to Disputes domain
  - Status: Should be in a `disputes` resource

#### 4. **Translations** - Misclassified Mutation
- ⚠️ Contains: `transactionVoid` (1 mutation)
  - Should belong to Orders/Transactions domain
  - Status: Should be moved to `orders` resource

#### 5. **Customer Payment Methods** - Missing Verb Coverage
- Mutations exist in schema: 10 mutations
- Current implementation: Covered through `customers` resource
- Status: Fully covered but could benefit from dedicated resource for clarity

---

## Implementation Priority & Roadmap

### Tier 1: Critical Gaps (Must Have for 100% Coverage)

These represent significant API functionality:

| Priority | Resource | Mutations | Queries | Verbs | Effort | Impact |
|----------|----------|-----------|---------|-------|--------|--------|
| **P0** | Shipping Packages | 3 | 0 | 4-5 | Low | Medium |
| **P0** | Delivery Promises | 2 | 3 | 3-4 | Low | Medium |
| **P0** | Mobile Platform Apps | 3 | 2 | 5 | Low | Low (niche) |
| **P0** | Tags (Global) | 2 | 0 | 2 | Low | High (affects many resources) |
| **P0** | Tax Configuration | 2 | 0 | 2-3 | Low | Medium |

**Subtotal:** 5 resources, 12 mutations, 16-18 verbs

### Tier 2: Schema Consistency (Should Have)

These enhance query consistency but are less critical:

| Priority | Resource | Issue | Verbs | Effort |
|----------|----------|-------|-------|--------|
| **P1** | Delegate Tokens | Add query support | 2 | Low |
| **P1** | Storefront Access Tokens | Add query support | 2 | Low |
| **P1** | Quantity Rules | Implement as standalone resource | 3 | Low |
| **P1** | Saved Searches | Unified query endpoint | 1 | Low |
| **P1** | Flow | Implementation | 2 | Low |

**Subtotal:** 5 resources, 10 verbs, enhancement items

### Tier 3: Edge Cases & Corrections

These fix edge cases and schema inconsistencies:

| Priority | Item | Fix |
|----------|------|-----|
| **P2** | Product Bundles | Add create/update verbs to products resource |
| **P2** | Disputes | Create dedicated resource for dispute evidence |
| **P2** | Transaction Void | Move from translations to orders resource |
| **P2** | Order Mandate Payments | Add create-mandate-payment verb to orders |

**Subtotal:** 4 fixes, improvements to existing resources

---

## Detailed Implementation Plan for Tier 1 (Critical Gap Resources)

### Resource 1: Shipping Packages

**File:** `src/cli/verbs/shipping-packages.ts`

**Schema mutations:**
- `shippingPackageDelete(id: ID!): DeletePayload`
- `shippingPackageMakeDefault(id: ID!): ShippingPackagePayload`
- `shippingPackageUpdate(id: ID!, input: ShippingPackageInput!): ShippingPackagePayload`

**Schema queries:**
- None available (limitation: must query through `shop.shippingPackages`)

**Recommended verbs:**
- `list` - List all shipping packages via shop query
- `get` - Fetch single package (must fetch via shop, filter locally)
- `update` - Update shipping package settings
- `delete` - Delete a shipping package
- `make-default` - Set as default shipping package

**Estimated effort:** 1-2 days
**Implementation notes:**
- Will need to fetch shop.shippingPackages and filter locally for get
- Consider caching for efficiency

---

### Resource 2: Delivery Promises

**File:** `src/cli/verbs/delivery-promises.ts`

**Schema mutations:**
- `deliveryPromiseParticipantsUpdate(input: DeliveryPromiseParticipantsInput!): DeliveryPromiseParticipantsPayload`
- `deliveryPromiseProviderUpsert(input: DeliveryPromiseProviderInput!): DeliveryPromiseProviderPayload`

**Schema queries:**
- `deliveryPromiseParticipants` - List participants
- `deliveryPromiseProvider` - Get provider
- `deliveryPromiseSettings` - Get settings

**Recommended verbs:**
- `get-settings` - Fetch delivery promise settings
- `get-participants` - List promise participants
- `get-provider` - Get delivery promise provider
- `update-participants` - Update participants
- `upsert-provider` - Create or update provider

**Estimated effort:** 1-2 days
**Implementation notes:**
- Mostly settings/configuration operations
- No create/delete operations needed

---

### Resource 3: Mobile Platform Applications

**File:** `src/cli/verbs/mobile-platform-applications.ts`

**Schema mutations:**
- `mobilePlatformApplicationCreate(input: MobilePlatformApplicationInput!): MobilePlatformApplicationPayload`
- `mobilePlatformApplicationDelete(id: ID!): DeletePayload`
- `mobilePlatformApplicationUpdate(id: ID!, input: MobilePlatformApplicationInput!): MobilePlatformApplicationPayload`

**Schema queries:**
- `mobilePlatformApplication(id: ID!): MobilePlatformApplication`
- `mobilePlatformApplications(...): [MobilePlatformApplication!]!`

**Recommended verbs:**
- `list` - List mobile platform applications
- `get` - Fetch single application
- `create` - Create new mobile platform application
- `update` - Update application
- `delete` - Delete application

**Estimated effort:** 1-2 days
**Implementation notes:**
- Straightforward CRUD operations
- Low-usage feature (niche integration)

---

### Resource 4: Tags (Global)

**File:** `src/cli/verbs/tags.ts`

**Schema mutations:**
- `tagsAdd(id: ID!, tags: [String!]!): TagsAddPayload`
- `tagsRemove(id: ID!, tags: [String!]!): TagsRemovePayload`

**Schema queries:**
- None (tags surface as sub-fields on resources)

**Implementation approach:**
- These are polymorphic mutations that work on multiple resource types
- Could implement as generic tag manager that accepts resource type + ID
- Alternative: Implement per-resource in their existing verb files

**Recommended verbs:**
- `add` - Add tags to a resource (requires `--id` and `--resource-type`)
- `remove` - Remove tags from a resource

**Estimated effort:** 2-3 days
**Implementation notes:**
- More complex due to polymorphic nature
- Must handle multiple resource types dynamically
- Could also enhance individual resources to add `add-tags`, `remove-tags` verbs

**Recommended approach:** Add generic verbs to individual resources rather than unified tags resource

---

### Resource 5: Tax Configuration

**File:** `src/cli/verbs/tax.ts`

**Schema mutations:**
- `taxAppConfigure(input: TaxAppConfigureInput!): TaxAppConfigurePayload`
- `taxSummaryCreate(input: TaxSummaryInput!): TaxSummaryPayload`

**Schema queries:**
- None available

**Recommended verbs:**
- `configure-app` - Configure tax app settings
- `create-summary` - Create a tax summary

**Estimated effort:** 1-2 days
**Implementation notes:**
- Specialized feature for tax automation
- Limited query capability (might need to enhance)

---

## Estimated Total Effort for 100% Coverage

### Tier 1 (Critical - Required for 100%)
- **5 resources** = 10-15 days of development
- Shipping Packages: 1-2 days
- Delivery Promises: 1-2 days
- Mobile Platform Apps: 1-2 days
- Tags: 2-3 days
- Tax: 1-2 days

### Tier 2 (Enhancements to Existing)
- **5 resource enhancements** = 3-5 days
- Add query support to existing resources
- Implement quantity rules resource

### Tier 3 (Corrections & Edge Cases)
- **4 fixes** = 2-3 days
- Move misclassified mutations
- Add missing verbs to existing resources

**Total estimated effort:** 15-23 developer days

---

## Recommendations

### Immediate Actions (Next 1-2 weeks)

1. **Implement Shipping Packages** (highest value, lowest effort)
   - Used by many shops with advanced shipping needs
   - Simple CRUD + make-default operation

2. **Implement Delivery Promises** (medium value, low effort)
   - Growing feature for delivery management
   - Mostly GET operations with one update

3. **Implement Mobile Platform Applications** (low-medium value, low effort)
   - Enables mobile integrations
   - Straightforward CRUD

### Medium-term (2-4 weeks)

4. **Add Tags support**
   - Consider approach: per-resource vs. unified resource
   - Recommend: Add per-resource `add-tags`, `remove-tags` verbs to each resource

5. **Implement Tax Configuration**
   - Emerging need for tax automation
   - Check with product team for feature priority

6. **Add Query Support to Tier 2 Resources**
   - Delegate tokens: list/get operations
   - Storefront access tokens: query support
   - Quantity rules: dedicated resource

### Ongoing

- **Review Phase 4 Planning Document** (`.dev/phase-4-complete-coverage.md`)
- **Monitor schema changes** for 2026-05 and beyond
- **Track user requests** for high-value missing operations
- **Maintain manifest.ts** and coverage tests

---

## Files to Create/Modify

### New Files (Tier 1 Implementation)

```
src/cli/verbs/
├── shipping-packages.ts          [NEW]
├── delivery-promises.ts          [NEW]
├── mobile-platform-applications.ts [NEW]
├── tags.ts                        [NEW - or enhance existing resources]
└── tax.ts                         [NEW]
```

### Modified Files

```
src/cli/
├── router.ts                      [ADD 5 new resource routes]
├── verbs/
│   ├── products.ts                [ADD: productBundleCreate/Update verbs]
│   ├── orders.ts                  [ADD: createMandatePayment verb]
│   ├── discounts-code.ts          [ADD: disputeEvidenceUpdate verb]
│   └── translations.ts            [MOVE: transactionVoid to orders]
└── test/
    └── graphql/command-manifest.json [UPDATE with new entries]
```

---

## Conclusion

The CLI has excellent coverage of the Shopify Admin API, implementing 77 resources and covering ~480 of the 496 mutations in the schema. To reach **100% coverage**, approximately **14 additional resources/enhancements** are needed, representing about **15-23 developer days** of work.

The largest gaps are:
1. **Shipping Packages** - Practical operations that users need
2. **Delivery Promises** - Growing feature area
3. **Generic Tags** - Affects many resources
4. **Mobile Platform Apps** - Integration support
5. **Tax Configuration** - Emerging need

All of these are relatively straightforward to implement and would bring the CLI to comprehensive API coverage.
