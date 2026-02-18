# Plan 5 — Platform, Admin, Content & Data model (62 root fields)

Decisions:
- New surfaces should nearly always be new resources (not bolted onto existing ones).
- Prefer new verbs over overloading existing verbs with extra flags.

Goal: implement the missing Admin API (2026-04) “platform/admin” operations: apps + billing, web presence + webhook/pubsub plumbing, backup/locales, content helpers, files/staged upload targets, metafield/metaobject definition utilities, shop-level utilities, and generic GraphQL helpers.

Scope (operations to cover)

Queries (32):
- `app`
- `appByHandle`
- `appByKey`
- `appDiscountType`
- `appDiscountTypes`
- `appDiscountTypesNodes`
- `appInstallations`
- `articleAuthors`
- `articleTags`
- `availableBackupRegions`
- `availableLocales`
- `backupRegion`
- `blogsCount`
- `channel`
- `channels`
- `currentAppInstallation`
- `domain`
- `fileSavedSearches`
- `metafieldDefinitionTypes`
- `metaobjectByHandle`
- `metaobjectDefinitionByType`
- `nodes`
- `onlineStore`
- `pagesCount`
- `publicApiVersions`
- `shopBillingPreferences`
- `shopPayPaymentRequestReceipt`
- `shopPayPaymentRequestReceipts`
- `shopifyqlQuery`
- `standardMetafieldDefinitionTemplates`
- `webPresences`
- `webhookSubscriptionsCount`

Mutations (30):
- `appPurchaseOneTimeCreate`
- `appRevokeAccessScopes`
- `appSubscriptionCreate`
- `appSubscriptionTrialExtend`
- `appUninstall`
- `appUsageRecordCreate`
- `backupRegionUpdate`
- `commentApprove`
- `commentNotSpam`
- `commentSpam`
- `fileAcknowledgeUpdateFailed`
- `menuCreate`
- `menuUpdate`
- `metafieldDefinitionPin`
- `metafieldDefinitionUnpin`
- `metafieldDefinitionUpdate`
- `metafieldsDelete`
- `metaobjectBulkDelete`
- `metaobjectUpsert`
- `pubSubServerPixelUpdate`
- `pubSubWebhookSubscriptionCreate`
- `pubSubWebhookSubscriptionUpdate`
- `stagedUploadTargetGenerate`
- `stagedUploadTargetsGenerate`
- `standardMetafieldDefinitionEnable`
- `standardMetaobjectDefinitionEnable`
- `storefrontAccessTokenCreate`
- `webPresenceCreate`
- `webPresenceDelete`
- `webPresenceUpdate`

Proposed CLI resources / verbs

- `apps` (new resource)
  - Queries: `get` (`app`), `by-handle`, `by-key`, `installations`, `current-installation`
  - Discount types: `discount-type`, `discount-types`, `discount-types-nodes`

- `app-billing` (keep mutations here; already exists)
  - Mutations:
    - `purchase-one-time-create`
    - `subscription-create`
    - `subscription-trial-extend`
    - `usage-record-create`
    - `uninstall`
    - `revoke-access-scopes`

- `web-presences` (new resource; global web presences)
  - Query: `list` (`webPresences`)
  - Mutations: `create|update|delete`

- `webhooks` (pubsub + counts; keep event-bridge in Plan 3)
  - Mutations: `pubsub-create`, `pubsub-update`
  - Query: `count` (`webhookSubscriptionsCount`)

- `server-pixels`
  - `pubsub-update` (`pubSubServerPixelUpdate`)

- `backup` (new resource)
  - Queries: `available-regions`, `region`
  - Mutation: `region-update`

- `locales` (new resource)
  - Query: `available` (`availableLocales`)

- `staged-uploads` (new resource; explicitly separate from `files`)
  - `target-generate`
  - `targets-generate`

- `storefront-access-tokens`
  - `create`

- `file-saved-searches` (new resource; isolate)
  - Query: `list` (`fileSavedSearches`)

- `articles` + `comments` + `menus`
  - Articles: `authors`, `tags`
  - Comments: `approve`, `spam`, `not-spam`
  - Menus: `create`, `update`
  - (Counts from `blogsCount` and `pagesCount` can be new resources or new verbs under `blogs`/`pages`.)

- `metafield-definition-tools` (new resource; utilities beyond CRUD)
  - `types` (`metafieldDefinitionTypes`)
  - `pin`, `unpin`, `update`
  - Standard templates/enablement:
    - `standard-templates`
    - `standard-enable`

- `metaobject-definition-tools` (new resource)
  - Standard enablement: `standard-enable` (`standardMetaobjectDefinitionEnable`)

- `metaobjects`
  - Query: `by-handle`, `definition-by-type`
  - Mutations: `upsert`, `bulk-delete`

- `shop` (shop-level utilities)
  - `billing-preferences`
  - `domain`
  - `online-store`
  - `public-api-versions`
  - Shop Pay receipts: `shop-pay-receipt`, `shop-pay-receipts`

- `graphql` (generic helpers)
  - `nodes` (multi-fetch by GIDs)
  - `shopifyql` query verb

Implementation outline

1. Add new resource verb files for the split surfaces (apps, web-presences, backup, staged-uploads, etc).
2. Wire new resources:
   - `src/cli/router.ts`
   - `src/cli/introspection/resources.ts`
   - `src/cli/help/registry.ts`
3. Implement remaining verbs in existing files where appropriate:
   - `src/cli/verbs/app-billing.ts`
   - `src/cli/verbs/webhooks.ts`
   - `src/cli/verbs/server-pixels.ts`
   - `src/cli/verbs/files.ts`
   - `src/cli/verbs/storefront-access-tokens.ts`
   - `src/cli/verbs/metafield-definitions.ts`
   - `src/cli/verbs/metaobject-definitions.ts`
   - `src/cli/verbs/metaobjects.ts`
   - `src/cli/verbs/shop.ts`
   - `src/cli/verbs/graphql.ts`
   - `src/cli/verbs/articles.ts`
   - `src/cli/verbs/comments.ts`
   - `src/cli/verbs/menus.ts`
4. Update/regen GraphQL test manifest + verify:
   - `npm run test:graphql:manifest`
   - `npm run typecheck`
   - `npm run check:help`
   - `npm run test`
   - `npx tsx scripts/report-admin-api-coverage.ts` drops missing root fields by 62.

