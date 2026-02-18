# Plan 2 — Customers, B2B, Segments & Privacy (55 root fields)

Decisions:
- New surfaces should nearly always be new resources (not bolted onto existing ones).
- Prefer new verbs over overloading existing verbs with extra flags.

Goal: implement the missing Admin API (2026-04) operations for customers + B2B companies + segments, including privacy/consent flows.

Scope (operations to cover)

Queries (16):
- `companyContactRole`
- `consentPolicy`
- `consentPolicyRegions`
- `customerByIdentifier`
- `customerMergeJobStatus`
- `customerMergePreview`
- `customerPaymentMethod`
- `customerSegmentMembers`
- `customerSegmentMembersQuery`
- `customerSegmentMembership`
- `privacySettings`
- `segmentFilterSuggestions`
- `segmentFilters`
- `segmentMigrations`
- `segmentValueSuggestions`
- `segmentsCount`

Mutations (39):
- `companiesDelete`
- `companyAddressDelete`
- `companyAssignCustomerAsContact`
- `companyAssignMainContact`
- `companyContactAssignRole`
- `companyContactCreate`
- `companyContactRevokeRole`
- `companyContactsDelete`
- `companyLocationCreate`
- `companyLocationsDelete`
- `consentPolicyUpdate`
- `customerAddTaxExemptions`
- `customerAddressCreate`
- `customerAddressDelete`
- `customerAddressUpdate`
- `customerCancelDataErasure`
- `customerEmailMarketingConsentUpdate`
- `customerGenerateAccountActivationUrl`
- `customerPaymentMethodCreateFromDuplicationData`
- `customerPaymentMethodCreditCardCreate`
- `customerPaymentMethodCreditCardUpdate`
- `customerPaymentMethodGetDuplicationData`
- `customerPaymentMethodGetUpdateUrl`
- `customerPaymentMethodPaypalBillingAgreementCreate`
- `customerPaymentMethodPaypalBillingAgreementUpdate`
- `customerPaymentMethodRemoteCreate`
- `customerPaymentMethodRevoke`
- `customerPaymentMethodSendUpdateEmail`
- `customerRemoveTaxExemptions`
- `customerReplaceTaxExemptions`
- `customerRequestDataErasure`
- `customerSegmentMembersQueryCreate`
- `customerSet`
- `customerSmsMarketingConsentUpdate`
- `customerUpdateDefaultAddress`
- `dataSaleOptOut`
- `privacyFeaturesDisable`
- `segmentCreate`
- `segmentUpdate`

Proposed CLI resources / verbs

- `customer-privacy` (new resource; isolate privacy flows)
  - `privacy-settings` (`privacySettings`)
  - `privacy-features-disable` (`privacyFeaturesDisable`)
  - `consent-policy` (`consentPolicy`)
  - `consent-policy-regions` (`consentPolicyRegions`)
  - `consent-policy-update` (`consentPolicyUpdate`)
  - `data-sale-opt-out` (`dataSaleOptOut`)

- `customers`
  - Lookup: `by-identifier`
  - Merge: `merge-preview`, `merge-job-status`
  - Updates: `set` (`customerSet`)
  - Addresses: `address-create`, `address-update`, `address-delete`, `update-default-address`
  - Consent/marketing: `email-marketing-consent-update`, `sms-marketing-consent-update`
  - Tax exemptions: `add-tax-exemptions`, `remove-tax-exemptions`, `replace-tax-exemptions`
  - Account activation: `generate-account-activation-url`
  - Data erasure: `request-data-erasure`, `cancel-data-erasure`

- `customer-payment-methods` (new resource; keep the matrix of payment-method mutations out of `customers`)
  - Query: `get` (`customerPaymentMethod`)
  - Credit cards: `credit-card-create`, `credit-card-update`
  - PayPal billing agreements: `paypal-billing-agreement-create`, `paypal-billing-agreement-update`
  - Remote: `remote-create`
  - Lifecycle: `revoke`, `send-update-email`
  - Duplication/update helpers:
    - `duplication-data-get` (`customerPaymentMethodGetDuplicationData`)
    - `duplication-create` (`customerPaymentMethodCreateFromDuplicationData`)
    - `update-url-get` (`customerPaymentMethodGetUpdateUrl`)

- `customer-segments` (new resource; segment-member queries are their own “surface”)
  - Queries: `members`, `membership`, `members-query`, `members-query-run` (if needed)
  - Mutation: `members-query-create`

- `segments`
  - `count` (`segmentsCount`)
  - `filters`, `filter-suggestions`, `value-suggestions`, `migrations`
  - `create`, `update`

- `companies`, `company-contacts`, `company-locations`
  - Companies: `delete`, `address-delete`, `assign-main-contact`
  - Contacts: `create`, `delete`, `assign-role`, `revoke-role`, plus `companyContactRole` query
  - Locations: `create`, `delete`
  - Association: `assign-customer-as-contact`

Implementation outline

1. Add new resources:
   - `src/cli/verbs/customer-privacy.ts`
   - `src/cli/verbs/customer-payment-methods.ts`
   - `src/cli/verbs/customer-segments.ts`
2. Wire new resources:
   - `src/cli/router.ts`
   - `src/cli/introspection/resources.ts`
   - `src/cli/help/registry.ts`
3. Implement remaining verbs in existing files:
   - `src/cli/verbs/customers.ts`
   - `src/cli/verbs/segments.ts`
   - `src/cli/verbs/companies.ts`
   - `src/cli/verbs/company-contacts.ts`
   - `src/cli/verbs/company-locations.ts`
4. Ensure output/view support and userErrors handling.
5. Update/regen GraphQL test manifest + verify:
   - `npm run test:graphql:manifest`
   - `npm run typecheck`
   - `npm run check:help`
   - `npm run test`
   - `npx tsx scripts/report-admin-api-coverage.ts` drops missing root fields by 55.

