# Plan 4 — Pricing, Markets, Subscriptions & Payments (61 root fields)

Decisions:
- New surfaces should nearly always be new resources (not bolted onto existing ones).
- Prefer new verbs over overloading existing verbs with extra flags.

Goal: implement the missing Admin API (2026-04) operations for markets/localization, discounts, price lists, selling plans, subscriptions (billing cycle operations), and payment/finance utilities.

Scope (operations to cover)

Queries (23):
- `automaticDiscount`
- `automaticDiscountSavedSearches`
- `automaticDiscounts`
- `codeDiscountSavedSearches`
- `discountNode`
- `discountNodes`
- `discountNodesCount`
- `discountRedeemCodeBulkCreation`
- `discountRedeemCodeSavedSearches`
- `financeAppAccessPolicy`
- `financeKycInformation`
- `marketByGeography`
- `marketLocalizableResource`
- `marketLocalizableResources`
- `marketLocalizableResourcesByIds`
- `marketingEvent`
- `marketingEvents`
- `marketsResolvedValues`
- `primaryMarket`
- `subscriptionBillingAttempts`
- `subscriptionBillingCycle`
- `subscriptionBillingCycleBulkResults`
- `tenderTransactions`

Mutations (38):
- `discountAutomaticBulkDelete`
- `discountCodeBulkDelete`
- `discountCodeRedeemCodeBulkDelete`
- `giftCardCredit`
- `giftCardDebit`
- `marketCurrencySettingsUpdate`
- `marketLocalizationsRegister`
- `marketLocalizationsRemove`
- `marketRegionDelete`
- `marketRegionsCreate`
- `marketRegionsDelete`
- `marketWebPresenceCreate`
- `marketWebPresenceDelete`
- `marketWebPresenceUpdate`
- `paymentCustomizationActivation`
- `paymentTermsCreate`
- `paymentTermsUpdate`
- `priceListFixedPricesAdd`
- `priceListFixedPricesByProductUpdate`
- `priceListFixedPricesDelete`
- `priceListFixedPricesUpdate`
- `quantityRulesAdd`
- `quantityRulesDelete`
- `sellingPlanGroupAddProductVariants`
- `sellingPlanGroupAddProducts`
- `sellingPlanGroupRemoveProductVariants`
- `sellingPlanGroupRemoveProducts`
- `shopifyPaymentsPayoutAlternateCurrencyCreate`
- `subscriptionBillingCycleCharge`
- `subscriptionBillingCycleContractDraftCommit`
- `subscriptionBillingCycleContractDraftConcatenate`
- `subscriptionBillingCycleContractEdit`
- `subscriptionBillingCycleEditDelete`
- `subscriptionBillingCycleEditsDelete`
- `subscriptionBillingCycleScheduleEdit`
- `subscriptionBillingCycleSkip`
- `subscriptionBillingCycleUnskip`
- `taxAppConfigure`

Proposed CLI resources / verbs

- `market-localizations` (new resource)
  - Queries: `localizable-resource`, `localizable-resources`, `localizable-resources-by-ids`
  - Mutations: `register`, `remove`

- `markets`
  - Queries: `by-geography`, `resolved-values`, `primary`
  - Mutations: `currency-settings-update`, `regions-create`, `regions-delete`, `region-delete`

- `market-web-presences` (new resource; separate from global `web-presences`)
  - `create|update|delete`

- `discount-nodes` (new resource; separate from `discounts-code` / `discounts-automatic`)
  - Queries: `get` (`discountNode`), `list` (`discountNodes`), `count` (`discountNodesCount`)

- `discount-saved-searches` (new resource)
  - `automatic` (`automaticDiscountSavedSearches`)
  - `code` (`codeDiscountSavedSearches`)
  - `redeem-code` (`discountRedeemCodeSavedSearches`)

- `discount-redeem-codes` (new resource)
  - Mutations: `bulk-create` (`discountRedeemCodeBulkCreation`), `bulk-delete` (`discountCodeRedeemCodeBulkDelete`)

- `discounts-automatic` / `discounts-code`
  - Query: `get` (`automaticDiscount`), `list` (`automaticDiscounts`)
  - Bulk delete: `bulk-delete` for both discount types

- `price-list-fixed-prices` (new resource)
  - Mutations: `add`, `update`, `delete`, `by-product-update`

- `quantity-rules` (new resource)
  - `add`, `delete`

- `selling-plan-group-products` (new resource; isolate association operations)
  - `add-products`, `remove-products`, `add-product-variants`, `remove-product-variants`

- `subscription-billing-cycles` (new resource)
  - Queries: `get`, `bulk-results`, `attempts`
  - Mutations:
    - `charge`
    - `skip` / `unskip`
    - `schedule-edit`
    - Draft/edit orchestration:
      - `contract-draft-commit`
      - `contract-draft-concatenate`
      - `contract-edit`
      - `edit-delete`
      - `edits-delete`

- `payment-customizations`
  - `activation`

- `payment-terms`
  - `create`, `update`

- `shopify-payments`
  - `payout-alternate-currency-create`

- `finance` (new resource)
  - Queries: `app-access-policy`, `kyc-information`

- `tender-transactions` (new resource)
  - Query: `list` (or `get`), depending on schema args

- `tax`
  - `app-configure`

- `gift-card-transactions` (new resource; keep credit/debit out of `gift-cards` if desired)
  - `credit`, `debit`

Implementation outline

1. Add new resource verb files for the split surfaces (discount-nodes, market-localizations, subscription-billing-cycles, etc).
2. Wire new resources:
   - `src/cli/router.ts`
   - `src/cli/introspection/resources.ts`
   - `src/cli/help/registry.ts`
3. Implement remaining verbs in existing files:
   - `src/cli/verbs/markets.ts`
   - `src/cli/verbs/discounts-automatic.ts`
   - `src/cli/verbs/discounts-code.ts`
   - `src/cli/verbs/price-lists.ts`
   - `src/cli/verbs/selling-plan-groups.ts`
   - `src/cli/verbs/subscription-billing.ts`
   - `src/cli/verbs/payment-customizations.ts`
   - `src/cli/verbs/payment-terms.ts`
   - `src/cli/verbs/shopify-payments.ts`
   - `src/cli/verbs/tax.ts`
4. Update/regen GraphQL test manifest + verify:
   - `npm run test:graphql:manifest`
   - `npm run typecheck`
   - `npm run check:help`
   - `npm run test`
   - `npx tsx scripts/report-admin-api-coverage.ts` drops missing root fields by 61.

