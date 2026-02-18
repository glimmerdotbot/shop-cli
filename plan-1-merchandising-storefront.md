# Plan 1 — Merchandising & Storefront operations (60 root fields)

Decisions:
- New surfaces should nearly always be new resources (not bolted onto existing ones).
- Prefer new verbs over overloading existing verbs with extra flags.

Goal: implement the missing Admin API (2026-04) operations in the merchandising + storefront area, and wire them into `shop <resource> <verb>` commands with full `--format`/`--view` support.

Scope (operations to cover)

Queries (21):
- `catalogOperations`
- `catalogsCount`
- `collectionByHandle`
- `collectionByIdentifier`
- `collectionRulesConditions`
- `productByHandle`
- `productByIdentifier`
- `productDuplicateJob`
- `productFeed`
- `productFeeds`
- `productOperation`
- `productResourceFeedback`
- `productTags`
- `productTypes`
- `productVariantByIdentifier`
- `productVendors`
- `publicationsCount`
- `publishedProductsCount`
- `urlRedirectImport`
- `urlRedirectSavedSearches`
- `urlRedirectsCount`

Mutations (39):
- `bulkProductResourceFeedbackCreate`
- `catalogContextUpdate`
- `collectionAddProducts`
- `collectionReorderProducts`
- `combinedListingUpdate`
- `productChangeStatus`
- `productCreateMedia`
- `productDeleteMedia`
- `productFeedCreate`
- `productFeedDelete`
- `productFullSync`
- `productJoinSellingPlanGroups`
- `productLeaveSellingPlanGroups`
- `productOptionUpdate`
- `productOptionsCreate`
- `productOptionsDelete`
- `productOptionsReorder`
- `productPublish`
- `productReorderMedia`
- `productSet`
- `productUnpublish`
- `productUpdateMedia`
- `productVariantAppendMedia`
- `productVariantDetachMedia`
- `productVariantJoinSellingPlanGroups`
- `productVariantLeaveSellingPlanGroups`
- `productVariantsBulkCreate`
- `productVariantsBulkDelete`
- `productVariantsBulkReorder`
- `productVariantsBulkUpdate`
- `publishablePublishToCurrentChannel`
- `publishableUnpublishToCurrentChannel`
- `shopResourceFeedbackCreate`
- `urlRedirectBulkDeleteAll`
- `urlRedirectBulkDeleteByIds`
- `urlRedirectBulkDeleteBySavedSearch`
- `urlRedirectBulkDeleteBySearch`
- `urlRedirectImportCreate`
- `urlRedirectImportSubmit`

Proposed CLI resources / verbs

- `products`
  - Lookups: `by-handle`, `by-identifier`
  - Ops/maintenance: `full-sync`, `operation`, `duplicate-job`
  - Publishing: `publish`, `unpublish`
  - Status: `change-status`
  - Merch introspection: `tags`, `types`, `vendors`
  - Selling plan association: `join-selling-plan-groups`, `leave-selling-plan-groups`
  - Media: `create-media`, `update-media`, `delete-media`, `reorder-media`
  - Set/update: `set` (backed by `productSet`)

- `product-variants`
  - Lookup: `by-identifier`
  - Bulk: `bulk-create`, `bulk-update`, `bulk-delete`, `bulk-reorder`
  - Selling plan association: `join-selling-plan-groups`, `leave-selling-plan-groups`
  - Media: `append-media`, `detach-media`

- `collections`
  - Lookups: `by-handle`, `by-identifier`
  - Rules introspection: `rules-conditions` (backed by `collectionRulesConditions`)
  - Product association: `add-products`, `reorder-products`

- `catalogs`
  - `count` (backed by `catalogsCount`)
  - `operations` (backed by `catalogOperations`)
  - `context-update` (backed by `catalogContextUpdate`)

- `product-feeds` (new resource; **not** `products`)
  - `get` (`productFeed`)
  - `list` (`productFeeds`)
  - `create` (`productFeedCreate`)
  - `delete` (`productFeedDelete`)

- `resource-feedback` (new resource)
  - `product-get` (`productResourceFeedback`)
  - `product-bulk-create` (`bulkProductResourceFeedbackCreate`)
  - `shop-create` (`shopResourceFeedbackCreate`)

- `publishables` (new resource; keep “current channel” ops separate from `publications`)
  - `publish-to-current-channel` (`publishablePublishToCurrentChannel`)
  - `unpublish-to-current-channel` (`publishableUnpublishToCurrentChannel`)

- `url-redirects`
  - `count` (`urlRedirectsCount`)
  - `saved-searches` (`urlRedirectSavedSearches`)
  - Import flow:
    - `import-create` (`urlRedirectImportCreate`)
    - `import-submit` (`urlRedirectImportSubmit`)
    - `import-get` (`urlRedirectImport`)
  - Bulk delete:
    - `bulk-delete-all` (`urlRedirectBulkDeleteAll`)
    - `bulk-delete-ids` (`urlRedirectBulkDeleteByIds`)
    - `bulk-delete-saved-search` (`urlRedirectBulkDeleteBySavedSearch`)
    - `bulk-delete-search` (`urlRedirectBulkDeleteBySearch`)

Implementation outline

1. Add new verb files for new resources:
   - `src/cli/verbs/product-feeds.ts`
   - `src/cli/verbs/resource-feedback.ts`
   - `src/cli/verbs/publishables.ts`
2. Wire new resources:
   - Router: `src/cli/router.ts`
   - Introspection mapping: `src/cli/introspection/resources.ts`
   - Help specs: `src/cli/help/registry.ts`
3. Implement remaining verbs in existing files:
   - `src/cli/verbs/products.ts`
   - `src/cli/verbs/product-variants.ts`
   - `src/cli/verbs/collections.ts`
   - `src/cli/verbs/catalogs.ts`
   - `src/cli/verbs/url-redirects.ts`
4. For each verb:
   - Selection-by-view (`summary`/`full`/`ids`/`raw`) using `as const`
   - `printNode` / `printConnection` / `printJson`
   - Handle `userErrors` via `maybeFailOnUserErrors`
5. Update/regen GraphQL test manifest + verify:
   - `npm run test:graphql:manifest`
   - `npm run typecheck`
   - `npm run check:help`
   - `npm run test`
   - `npx tsx scripts/report-admin-api-coverage.ts` drops missing root fields by 60.

