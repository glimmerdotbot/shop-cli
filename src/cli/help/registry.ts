import type { FlagSpec, ResourceSpec, VerbSpec } from './spec'
import { resourceToType } from '../introspection/resources'

const flag = (label: string, description: string): FlagSpec => ({ label, description })

const flagId = flag('--id <gid>', 'Resource ID (numeric ID or full gid://shopify/... GID)')
const flagIds = flag('--ids <gid>', 'Repeatable or comma-separated IDs')
const flagYes = flag('--yes', 'Confirm destructive action')
const flagInput = flag('--input <json|@file>', 'Full input payload as JSON')
const flagSet = flag('--set <path>=<value>', 'Set individual fields (repeatable)')
const flagSetJson = flag('--set-json <path>=<json>', 'Set individual fields with JSON values (repeatable)')
const flagFirst = flag('--first <n>', 'Page size (default: 50)')
const flagAfter = flag('--after <cursor>', 'Pagination cursor')
const flagQuery = flag('--query <string>', 'Search query')
const flagPublished = flag(
  '--published',
  'Filter to published products (adds published_status:published to --query)',
)
const flagLimit = flag('--limit <n>', 'Upper bound on count value (default: 10000)')
const flagSort = flag('--sort <key>', 'Sort key')
const flagReverse = flag('--reverse', 'Reverse sort order')
const flagFormat = flag('--format json|table|raw|markdown', 'Select output format')
const flagView = flag('--view summary|ids|full|raw|all', 'Select a built-in view')
const flagSelect = flag('--select <path>', 'Add fields to the selection (repeatable)')
const flagInclude = flag('--include <connection>', 'Include a connection field with --view all (repeatable)')
const flagSelection = flag('--selection <graphql>', 'Override selection (can be @file.gql)')
const flagQuiet = flag('--quiet', 'IDs only when possible')
const flagTags = flag('--tags <csv>', 'Comma-separated tags')
const flagIdentifierJsonFile = flag('--identifier <json|@file>', 'Identifier JSON (inline or @file.json)')
const flagStatus = flag('--status <value>', 'Status value')
const flagNewTitle = flag('--new-title <string>', 'Title for the duplicate')
const flagSavedSearchId = flag('--saved-search-id <gid>', 'Saved search ID')
const flagSynchronous = flag('--synchronous <bool>', 'Run synchronously (default: true)')

const flagOrderId = flag('--order-id <gid>', 'Order ID')
const flagCustomerId = flag('--customer-id <gid>', 'Customer ID')
const flagCompanyId = flag('--company-id <gid>', 'Company ID')
const flagContactId = flag('--contact-id <gid>', 'Company contact ID')
const flagLocationId = flag('--location-id <gid>', 'Location ID')
const flagAddressId = flag('--address-id <gid>', 'Address ID')
const flagJobId = flag('--job-id <id>', 'Job ID')
const flagEmailAddress = flag('--email-address <string>', 'Email address')
const flagPhoneNumber = flag('--phone-number <string>', 'Phone number')
const flagIdentifierId = flag('--identifier-id <gid>', 'Customer ID identifier')
const flagCustomId = flag('--custom-id <json>', 'Customer custom ID (UniqueMetafieldValueInput JSON)')
const flagIdentifier = flag('--identifier <json>', 'Customer set identifier (CustomerSetIdentifiers JSON)')
const flagSetAsDefault = flag('--set-as-default <bool>', 'Set as default')
const flagEmailMarketingConsent = flag('--email-marketing-consent <json>', 'Email marketing consent JSON')
const flagSmsMarketingConsent = flag('--sms-marketing-consent <json>', 'SMS marketing consent JSON')
const flagSearch = flag('--search <string>', 'Search term')
const flagFilterQueryName = flag('--filter-query-name <string>', 'Filter query name')
const flagFunctionParameterQueryName = flag('--function-parameter-query-name <string>', 'Function parameter query name')
const flagSegmentId = flag('--segment-id <gid>', 'Segment ID')
const flagSegmentIds = flag('--segment-ids <gid>', 'Segment IDs (repeatable or comma-separated)')
const flagQueryId = flag('--query-id <gid>', 'Segment members query ID')
const flagTimezone = flag('--timezone <string>', 'Timezone (IANA, e.g. America/New_York)')

const flagShowRevoked = flag('--show-revoked', 'Include revoked payment methods')
const flagBillingAddress = flag('--billing-address <json>', 'Billing address JSON')
const flagSessionId = flag('--session-id <string>', 'Card session ID')
const flagRemoteReference = flag('--remote-reference <json>', 'Remote reference JSON')
const flagBillingAgreementId = flag('--billing-agreement-id <string>', 'PayPal billing agreement ID (B-...)')
const flagInactive = flag('--inactive <bool>', 'Inactive flag')
const flagTargetCustomerId = flag('--target-customer-id <gid>', 'Target customer ID')
const flagTargetShopId = flag('--target-shop-id <gid>', 'Target shop ID')
const flagEncryptedDuplicationData = flag('--encrypted-duplication-data <string>', 'Encrypted duplication data')

const flagFeatures = flag('--features <csv>', 'Privacy features (comma-separated)')
const flagCountryCode = flag('--country-code <code>', 'Country code (ISO 3166)')
const flagRegionCode = flag('--region-code <code>', 'Region code')
const flagConsentRequired = flag('--consent-required <bool>', 'Consent required')
const flagDataSaleOptOutRequired = flag('--data-sale-opt-out-required <bool>', 'Data sale opt-out required')
const flagFromLocationId = flag('--from-location-id <gid>', 'From location ID')
const flagToLocationId = flag('--to-location-id <gid>', 'To location ID')
const flagInventoryItemId = flag('--inventory-item-id <gid>', 'Inventory item ID')
const flagVariantId = flag('--variant-id <gid>', 'Variant ID')
const flagVariantIds = flag('--variant-ids <gid>', 'Variant IDs (repeatable or comma-separated)')
const flagProductId = flag('--product-id <gid>', 'Product ID')
const flagGroupIds = flag('--group-ids <gid>', 'Selling plan group IDs (repeatable)')
const flagPublicationId = flag('--publication-id <gid>', 'Publication ID (repeatable)')
const flagPublication = flag('--publication <name>', 'Publication name (repeatable; resolves by name)')
const flagAt = flag('--at <iso>', 'Publish at a specific ISO timestamp')
const flagNow = flag('--now', 'Publish immediately')
const flagUrl = flag('--url <url>', 'URL (repeatable)')
const flagFile = flag('--file <path>', 'Local file path (repeatable)')
const flagFilesUploadFilename = flag(
  '--filename <name>',
  'Override filename (only with exactly 1 --url, or with --file -)',
)
const flagAlt = flag('--alt <string>', 'Alt text')
const flagFilesUploadMimeType = flag('--mime-type <mime>', 'Override MIME detection')
const flagFilesUploadMediaType = flag('--media-type <type>', 'FILE|IMAGE|VIDEO|MODEL_3D')
const flagFilesUploadWait = flag('--wait', 'Poll until fileStatus is READY or FAILED')
const flagPollIntervalMs = flag('--poll-interval-ms <n>', 'Poll interval in milliseconds (default: 1000)')
const flagTimeoutMs = flag('--timeout-ms <n>', 'Polling timeout in milliseconds (default: 600000)')
const flagContentType = flag('--content-type <mime>', 'Override detected content type')
const flagMediaType = flag('--media-type <type>', 'IMAGE|VIDEO|MODEL_3D|EXTERNAL_VIDEO')
const flagMediaContentType = flag('--media-content-type <type>', 'IMAGE|VIDEO|MODEL_3D|EXTERNAL_VIDEO')
const flagAllowPartialUpdates = flag('--allow-partial-updates', 'Allow partial updates')
const flagStrategy = flag('--strategy <value>', 'DEFAULT|PRESERVE_STANDALONE_VARIANT|REMOVE_STANDALONE_VARIANT')
const flagOwnerType = flag('--owner-type <type>', 'Owner type filter')
const flagType = flag('--type <string>', 'Type value')
const flagKey = flag('--key <string>', 'Key')
const flagNamespace = flag('--namespace <string>', 'Namespace')
const flagTopic = flag('--topic <topic>', 'Webhook topic')
const flagResourceType = flag('--resource-type <type>', 'Resource type')
const flagResourceId = flag('--resource-id <gid>', 'Resource ID')
const flagResourceIds = flag('--resource-ids <gid>', 'Resource IDs (repeatable)')
const flagPlatform = flag('--platform <apple|android>', 'Platform (used only when coercing numeric IDs)')
const flagLocale = flag('--locale <string>', 'Locale')
const flagLocales = flag('--locales <csv>', 'Locales (repeatable or comma-separated)')
const flagTranslationKeys = flag('--translation-keys <csv>', 'Translation keys (repeatable)')
const flagMarketIds = flag('--market-ids <gid>', 'Market IDs (repeatable)')
const flagMarketId = flag('--market-id <gid>', 'Market ID')
const flagCountryCodes = flag('--country-codes <csv>', 'Country codes (comma-separated)')
const flagKeys = flag('--keys <csv>', 'Keys (comma-separated)')
const flagProductIds = flag('--product-ids <gid>', 'Product IDs (repeatable or comma-separated)')
const flagFunctionId = flag('--function-id <gid>', 'Function ID')
const flagFunctionHandle = flag('--function-handle <handle>', 'Function handle')
const flagBlockOnFailure = flag('--block-on-failure', 'Block checkout on failure')
const flagMetafields = flag('--metafields <json>', 'Metafields JSON')
const flagProfileId = flag('--profile-id <gid>', 'Checkout profile ID')
const flagEnabled = flag('--enabled <bool>', 'Enable/disable')
const flagCustomIdNamespace = flag('--custom-id-namespace <string>', 'Custom identifier namespace')
const flagCustomIdKey = flag('--custom-id-key <string>', 'Custom identifier key')
const flagCustomIdValue = flag('--custom-id-value <string>', 'Custom identifier value')
const flagPaymentReferenceId = flag('--payment-reference-id <string>', 'Payment reference ID')
const flagPaymentMethodName = flag('--payment-method-name <string>', 'Payment method name')
const flagProcessedAt = flag('--processed-at <iso>', 'Processed at timestamp')
const flagFinalCapture = flag('--final-capture <bool>', 'Final capture flag')
const flagRiskLevel = flag('--risk-level <string>', 'Risk level')
const flagFacts = flag('--facts <json|@file>', 'Facts JSON array')
const flagSubjectTypes = flag('--subject-types <csv>', 'Subject types (comma-separated)')
const flagAssignmentStatus = flag('--assignment-status <string>', 'Assignment status filter')
const flagLocationIds = flag('--location-ids <gid>', 'Location IDs (repeatable or comma-separated)')
const flagInventoryLevelId = flag('--inventory-level-id <gid>', 'Inventory level ID')
const flagTransferId = flag('--transfer-id <gid>', 'Inventory transfer ID')
const flagUpdates = flag('--updates <json|@file>', 'Updates JSON')
const flagAvailable = flag('--available <int>', 'Available quantity')
const flagOnHand = flag('--on-hand <int>', 'On-hand quantity')
const flagStockAtLegacyLocation = flag('--stock-at-legacy-location <bool>', 'Stock at legacy location flag')
const flagActivate = flag('--activate <bool>', 'Activate flag')
const flagDisposition = flag('--disposition <id>:<qty>:<type>[:<locationId>]', 'Disposition (repeatable)')
const flagReverseFulfillmentOrderId = flag('--reverse-fulfillment-order-id <id>', 'Reverse fulfillment order ID')
const flagLineItem = flag('--line-item <id>:<qty>', 'Reverse delivery line item (repeatable)')
const flagLabelUrl = flag('--label-url <url>', 'Label URL')
const flagRoles = flag('--roles <role>', 'Theme roles (repeatable)')
const flagName = flag('--name <string>', 'Name')
const flagHandle = flag('--handle <string>', 'Handle')
const flagApiKey = flag('--api-key <string>', 'API key')
const flagReturnUrl = flag('--return-url <url>', 'Return URL')
const flagLineItems = flag('--line-items <json>', 'Line items JSON array')
const flagTrialDays = flag('--trial-days <n>', 'Trial days')
const flagReplacementBehavior = flag('--replacement-behavior <value>', 'Replacement behavior')
const flagScopes = flag('--scopes <csv>', 'Scopes (comma-separated)')
const flagCategory = flag('--category <value>', 'Category filter')
const flagPrivacy = flag('--privacy <value>', 'Privacy filter')
const flagDefinitionId = flag('--definition-id <gid>', 'Definition ID')
const flagConstraintSubtype = flag('--constraint-subtype <value>', 'Constraint subtype')
const flagConstraintStatus = flag('--constraint-status <value>', 'Constraint status')
const flagExcludeActivated = flag('--exclude-activated', 'Exclude activated templates')
const flagVisibleToStorefrontApi = flag('--visible-to-storefront-api <bool>', 'Visible to Storefront API')
const flagUseAsCollectionCondition = flag('--use-as-collection-condition <bool>', 'Use as collection condition')
const flagResource = flag('--resource <type>', 'Resource type')
const flagFilename = flag('--filename <string>', 'Filename')
const flagMimeType = flag('--mime-type <mime>', 'MIME type')
const flagFileSize = flag('--file-size <bytes>', 'File size in bytes')
const flagHttpMethod = flag('--http-method <method>', 'HTTP method')
const flagRole = flag('--role <role>', 'Role')
const flagSource = flag('--source <url>', 'Source URL (or src)')
const flagFiles = flag('--files <json>', 'Files JSON (paths or mappings)')
const flagWait = flag('--wait', 'Wait for completion')
const flagWaitInterval = flag('--wait-interval <seconds>', 'Polling interval in seconds')
const flagMutation = flag('--mutation <graphql>', 'Bulk mutation document')
const flagStagedUploadPath = flag('--staged-upload-path <path>', 'Staged upload path')
const flagClientId = flag('--client-id <string>', 'Client identifier')
const flagContractId = flag('--contract-id <gid>', 'Subscription contract ID')
const flagCycleIndex = flag('--cycle-index <n>', 'Billing cycle index')
const flagCycleIndexes = flag('--cycle-indexes <csv>', 'Billing cycle indexes')
const flagDraftId = flag('--draft-id <gid>', 'Subscription draft ID')
const flagAccountId = flag('--account-id <gid>', 'Account ID')
const flagDate = flag('--date <date>', 'Date (YYYY-MM-DD)')
const flagLineId = flag('--line-id <gid>', 'Line item ID')
const flagDiscountId = flag('--discount-id <gid>', 'Discount ID')
const flagCode = flag('--code <string>', 'Discount code')
const flagReason = flag('--reason <string>', 'Reason')
const flagQuantityName = flag('--quantity-name <string>', 'Quantity name (default: available)')
const flagReferenceDocumentUri = flag('--reference-document-uri <url>', 'Reference document URL')
const flagNotes = flag('--notes <string>', 'Notes')
const flagMessage = flag('--message <string>', 'Message')
const flagEstimatedShippedAt = flag('--estimated-shipped-at <iso>', 'Estimated shipped at')
const flagNotifyCustomer = flag('--notify-customer', 'Notify customer')
const flagHoldIds = flag('--hold-ids <gid>', 'Fulfillment hold IDs (repeatable)')
const flagFulfillAt = flag('--fulfill-at <iso>', 'Fulfill at timestamp')
const flagDeadline = flag('--deadline <iso>', 'Fulfillment deadline')
const flagQuantity = flag('--quantity <n>', 'Quantity')
const flagLineItemId = flag('--line-item-id <gid>', 'Line item ID')
const flagLineItemIds = flag('--line-item-ids <gid>', 'Line item IDs (repeatable)')
const flagDiscountApplicationId = flag('--discount-application-id <gid>', 'Discount application ID')
const flagShippingLineId = flag('--shipping-line-id <gid>', 'Shipping line ID')
const flagStaffNote = flag('--staff-note <string>', 'Staff note')
const flagAllowDuplicates = flag('--allow-duplicates', 'Allow duplicate line items')
const flagTitle = flag('--title <string>', 'Title')
const flagPrice = flag('--price <json>', 'Price JSON')
const flagTaxable = flag('--taxable', 'Taxable')
const flagRequiresShipping = flag('--requires-shipping', 'Requires shipping')
const flagAssignmentIds = flag('--assignment-ids <gid>', 'Assignment IDs (repeatable)')
const flagRoleId = flag('--role-id <gid>', 'Role ID')
const flagRoleAssignments = flag('--role-assignments <json>', 'Role assignments JSON')
const flagRoleAssignmentId = flag('--role-assignment-id <gid>', 'Role assignment ID')
const flagRoleAssignmentIds = flag('--role-assignment-ids <gid>', 'Role assignment IDs (repeatable)')
const flagStaffMemberIds = flag('--staff-member-ids <gid>', 'Staff member IDs (repeatable)')
const flagAddressType = flag('--address-type <type>', 'Address type (repeatable)')
const flagAddress = flag('--address <json>', 'Address JSON')
const flagExemptions = flag('--exemptions <csv>', 'Tax exemptions (repeatable)')
const flagRemoveExemptions = flag('--remove-exemptions <csv>', 'Tax exemptions to remove (repeatable)')
const flagTaxId = flag('--tax-id <string>', 'Tax ID')
const flagTaxExempt = flag('--tax-exempt <bool>', 'Tax exempt flag')
const flagOwnerId = flag('--owner-id <gid>', 'Owner ID (repeatable)')
const flagAmount = flag('--amount <number>', 'Amount')

const flagBrandedPromiseHandle = flag('--branded-promise-handle <string>', 'Branded promise handle')
const flagOwnersToAdd = flag('--owners-to-add <gid>', 'Owner IDs to add (repeatable)')
const flagOwnersToRemove = flag('--owners-to-remove <gid>', 'Owner IDs to remove (repeatable)')
const flagActive = flag('--active <bool>', 'Active flag')
const flagFulfillmentDelay = flag('--fulfillment-delay <int>', 'Fulfillment delay in seconds')
const flagTimeZone = flag('--time-zone <string>', 'Time zone (for schedules/cutoffs)')
const flagReady = flag('--ready <bool>', 'Tax app readiness')
const flagStartTime = flag('--start-time <iso>', 'Start time (ISO 8601)')
const flagEndTime = flag('--end-time <iso>', 'End time (ISO 8601)')
const flagFlowHandle = flag('--handle <string>', 'Flow trigger handle')
const flagFlowPayload = flag('--payload <json|@file>', 'Payload JSON (inline or @file.json)')
const flagMandateId = flag('--mandate-id <gid>', 'Payment mandate ID')
const flagPaymentScheduleId = flag('--payment-schedule-id <gid>', 'Payment schedule ID')
const flagAutoCapture = flag('--auto-capture <bool>', 'Whether to capture immediately (default: true)')
const flagParentTransactionId = flag('--parent-transaction-id <gid>', 'Parent transaction ID')
const flagCurrency = flag('--currency <code>', 'Currency code')
const flagExpiresAt = flag('--expires-at <iso>', 'Expiration timestamp')
const flagNotify = flag('--notify', 'Notify')
const flagToken = flag('--token <string>', 'Access token')
const flagItems = flag('--items <json>', 'Items JSON')
const flagPositions = flag('--positions <json>', 'Positions JSON')
const flagMoves = flag('--moves <json>', 'Moves JSON array (or @file.json)')
const flagMove = flag('--move <id>:<newPosition>', 'Move entry (repeatable)')
const flagMediaIds = flag('--media-ids <gid>', 'Media IDs (repeatable)')
const flagMediaId = flag('--media-id <gid>', 'Media ID (repeatable)')
const flagMedia = flag('--media <json|@file>', 'Media JSON array (inline or @file.json)')
const flagVariantMedia = flag('--variant-media <json>', 'Variant media JSON')
const flagHandles = flag('--handles <csv>', 'Handles (repeatable)')
const flagDeclineReason = flag('--decline-reason <string>', 'Decline reason')
const flagDeclineNote = flag('--decline-note <string>', 'Decline note')
const flagReturnLineItemId = flag('--return-line-item-id <gid>', 'Return line item ID')
const flagDateShipped = flag('--date-shipped <date>', 'Date shipped')
const flagBulkReceiveAction = flag('--bulk-receive-action <value>', 'Bulk receive action')
const flagDateReceived = flag('--date-received <date>', 'Date received')
const flagTracking = flag('--tracking <json>', 'Tracking JSON')
const flagTrackingCompany = flag('--tracking-company <string>', 'Tracking company')
const flagTrackingNumber = flag('--tracking-number <string>', 'Tracking number')
const flagTrackingUrl = flag('--tracking-url <url>', 'Tracking URL')
const flagStatusValue = flag('--status <value>', 'Status value')
const flagHappenedAt = flag('--happened-at <iso>', 'Happened at timestamp')
const flagRemoteId = flag('--remote-id <string>', 'Remote ID')
const flagUtm = flag('--utm <json>', 'UTM JSON')
const flagActivityId = flag('--activity-id <gid>', 'Marketing activity ID')
const flagChannelHandle = flag('--channel-handle <string>', 'Channel handle')
const flagAll = flag('--all', 'Apply to all')
const flagApiType = flag('--api-type <string>', 'API type')
const flagUseCreationUi = flag('--use-creation-ui', 'Use creation UI')
const flagPubSubProject = flag('--pubsub-project <string>', 'Pub/Sub project')
const flagPubSubTopic = flag('--pubsub-topic <string>', 'Pub/Sub topic')
const flagArn = flag('--arn <string>', 'EventBridge ARN')
const flagLineItemIdsCsv = flag('--line-item-ids <gid>', 'Line item IDs (repeatable)')
const flagRedeemCodes = flag('--codes <csv>', 'Codes (repeatable)')
const flagSubscriptionLineItemId = flag('--subscription-line-item-id <gid>', 'Subscription line item ID')
const flagDescription = flag('--description <string>', 'Description')
const flagIdempotencyKey = flag('--idempotency-key <string>', 'Unique key to identify a request')
const flagProrate = flag('--prorate', 'Prorate the cancellation')
const flagDays = flag('--days <n>', 'Number of days')

const flagCatalogId = flag('--catalog-id <gid>', 'Catalog ID')
const flagContextsToAdd = flag('--contexts-to-add <json|@file>', 'Catalog contexts to add (JSON)')
const flagContextsToRemove = flag('--contexts-to-remove <json|@file>', 'Catalog contexts to remove (JSON)')
const flagUpdatedAtSince = flag('--updated-at-since <iso>', 'Only updated since timestamp')
const flagBeforeUpdatedAt = flag('--before-updated-at <iso>', 'Only updated before timestamp')

const flagOptions = flag('--options <json|@file>', 'Options JSON array (inline or @file.json)')
const flagOption = flag('--option <json|@file>', 'Option JSON object (inline or @file.json)')
const flagOptionIds = flag('--option-ids <id,id,...>', 'Option IDs (comma-separated or repeatable)')
const flagVariantStrategy = flag('--variant-strategy <value>', 'Variant strategy')
const flagOptionValuesToAdd = flag('--option-values-to-add <json|@file>', 'Option values to add (JSON)')
const flagOptionValuesToDelete = flag('--option-values-to-delete <json|@file>', 'Option value IDs to delete (JSON)')
const flagOptionValuesToUpdate = flag('--option-values-to-update <json|@file>', 'Option values to update (JSON)')

const flagParentProductId = flag('--parent-product-id <gid>', 'Parent product ID')
const flagProductsAdded = flag('--products-added <json|@file>', 'Child products to add (JSON)')
const flagProductsEdited = flag('--products-edited <json|@file>', 'Child products to edit (JSON)')
const flagProductsRemovedIds = flag('--products-removed-ids <gid>', 'Product IDs to remove (repeatable or comma-separated)')
const flagOptionsAndValues = flag('--options-and-values <json|@file>', 'Options and values to reorder (JSON)')

const inputFlags = [flagInput, flagSet, flagSetJson]

const createVerb = ({
  operation,
  inputArg,
  description,
  requiredFlags,
  flags,
  examples,
  notes,
}: {
  operation: string
  inputArg?: string
  description?: string
  requiredFlags?: FlagSpec[]
  flags?: FlagSpec[]
  examples?: string[]
  notes?: string[]
}): VerbSpec => ({
  verb: 'create',
  description,
  operation: { type: 'mutation', name: operation, inputArg },
  input: { mode: 'set', arg: inputArg, required: true },
  requiredFlags,
  flags,
  examples,
  notes,
})

const updateVerb = ({
  operation,
  inputArg,
  description,
  requiredFlags = [],
  flags,
  examples,
  notes,
  inputRequired = true,
}: {
  operation: string
  inputArg?: string
  description?: string
  requiredFlags?: FlagSpec[]
  flags?: FlagSpec[]
  examples?: string[]
  notes?: string[]
  inputRequired?: boolean
}): VerbSpec => ({
  verb: 'update',
  description,
  operation: { type: 'mutation', name: operation, inputArg },
  input: { mode: 'set', arg: inputArg, required: inputRequired },
  requiredFlags: [flagId, ...requiredFlags],
  flags,
  examples,
  notes,
})

const getVerb = ({
  operation,
  description,
  notes,
}: {
  operation: string
  description?: string
  notes?: string[]
}): VerbSpec => ({
  verb: 'get',
  description,
  operation: { type: 'query', name: operation },
  requiredFlags: [flagId],
  output: { view: true, selection: true },
  notes,
})

const listVerb = ({
  operation,
  description,
  notes,
  flags,
}: {
  operation: string
  description?: string
  notes?: string[]
  flags?: FlagSpec[]
}): VerbSpec => ({
  verb: 'list',
  description,
  operation: { type: 'query', name: operation },
  output: { view: true, selection: true, pagination: true },
  notes,
  flags,
})

const deleteVerb = ({
  operation,
  description,
  requiredFlags = [],
  notes,
}: {
  operation: string
  description?: string
  requiredFlags?: FlagSpec[]
  notes?: string[]
}): VerbSpec => ({
  verb: 'delete',
  description,
  operation: { type: 'mutation', name: operation },
  requiredFlags: [flagId, flagYes, ...requiredFlags],
  notes,
})

const duplicateVerb = ({
  operation,
  description,
  requiredFlags = [],
  flags,
  notes,
}: {
  operation: string
  description?: string
  requiredFlags?: FlagSpec[]
  flags?: FlagSpec[]
  notes?: string[]
}): VerbSpec => ({
  verb: 'duplicate',
  description,
  operation: { type: 'mutation', name: operation },
  requiredFlags: [flagId, ...requiredFlags],
  flags,
  notes,
})

const countVerb = ({
  operation,
  description,
  flags,
}: {
  operation: string
  description?: string
  flags?: FlagSpec[]
}): VerbSpec => ({
  verb: 'count',
  description,
  operation: { type: 'query', name: operation },
  flags,
})

const inputVerb = ({
  verb,
  operation,
  inputArg,
  description,
  requiredFlags = [],
  flags,
  notes,
  inputRequired = true,
  output,
}: {
  verb: string
  operation: string
  inputArg?: string
  description?: string
  requiredFlags?: FlagSpec[]
  flags?: FlagSpec[]
  notes?: string[]
  inputRequired?: boolean
  output?: VerbSpec['output']
}): VerbSpec => ({
  verb,
  description,
  operation: { type: 'mutation', name: operation, inputArg },
  input: { mode: 'set', arg: inputArg, required: inputRequired },
  requiredFlags,
  flags,
  notes,
  output,
})

const fieldsVerb: VerbSpec = {
  verb: 'fields',
  description: 'List available fields for --select',
}

const resourcesWithFields = new Set(Object.keys(resourceToType))

const baseCommandRegistry: ResourceSpec[] = [
  {
    resource: 'products',
    description: 'Manage products.',
    notes: [
      'To list products in a collection, use `shop collections list-products --id <collectionId>` or `shop collections list-products --handle <handle>`.',
    ],
    verbs: [
      createVerb({ operation: 'productCreate', description: 'Create a new product.' }),
      getVerb({
        operation: 'product',
        description: 'Fetch a product by ID.',
        notes: [
          'To list products in a collection, use `shop collections list-products --id <collectionId>` or `shop collections list-products --handle <handle>`.',
        ],
      }),
      {
        verb: 'by-handle',
        description: 'Fetch a product by handle.',
        operation: { type: 'query', name: 'productByHandle' },
        requiredFlags: [flagHandle],
        output: { view: true, selection: true },
      },
      {
        verb: 'by-identifier',
        description: 'Fetch a product by identifier.',
        operation: { type: 'query', name: 'productByIdentifier' },
        requiredFlags: [flagIdentifierJsonFile],
        output: { view: true, selection: true },
      },
      listVerb({
        operation: 'products',
        description: 'List products.',
        flags: [flagPublished],
        notes: [
          'To list products in a collection, use `shop collections list-products --id <collectionId>` or `shop collections list-products --handle <handle>`.',
        ],
      }),
      countVerb({
        operation: 'productsCount',
        description: 'Count products.',
        flags: [flagQuery, flagLimit, flagSavedSearchId],
      }),
      {
        verb: 'tags',
        description: 'List product tags in the shop.',
        operation: { type: 'query', name: 'productTags' },
        output: { pagination: true },
      },
      {
        verb: 'types',
        description: 'List product types in the shop.',
        operation: { type: 'query', name: 'productTypes' },
        output: { pagination: true },
      },
      {
        verb: 'vendors',
        description: 'List product vendors in the shop.',
        operation: { type: 'query', name: 'productVendors' },
        output: { pagination: true },
      },
      updateVerb({ operation: 'productUpdate', description: 'Update a product.' }),
      deleteVerb({ operation: 'productDelete', description: 'Delete a product.' }),
      duplicateVerb({
        operation: 'productDuplicate',
        description: 'Duplicate a product.',
        flags: [
          flagNewTitle,
          flagSet,
          flagSetJson,
        ],
        notes: ['You can also pass --set newTitle="..." to override the duplicate title.'],
      }),
      {
        verb: 'archive',
        description: 'Archive a product (sets status=ARCHIVED).',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'unarchive',
        description: 'Unarchive a product (sets status=DRAFT by default).',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId],
        flags: [flagStatus],
        notes: ['Use --status to set the post-unarchive status (default: DRAFT).'],
        output: { view: true, selection: true },
      },
      {
        verb: 'set-status',
        description: 'Set product status.',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId, flagStatus],
      },
      {
        verb: 'change-status',
        description: 'Change product status (deprecated).',
        operation: { type: 'mutation', name: 'productChangeStatus' },
        requiredFlags: [flagId, flagStatus],
        notes: ['Prefer `shop products set-status` (productUpdate).'],
      },
      {
        verb: 'set',
        description: 'Create or update products via productSet.',
        operation: { type: 'mutation', name: 'productSet', inputArg: 'input' },
        input: { mode: 'set', arg: 'input', required: true },
        flags: [...inputFlags, flagIdentifierJsonFile, flagSynchronous],
      },
      {
        verb: 'operation',
        description: 'Fetch a product operation by ID.',
        operation: { type: 'query', name: 'productOperation' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'duplicate-job',
        description: 'Fetch a product duplicate job by ID.',
        operation: { type: 'query', name: 'productDuplicateJob' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'join-selling-plan-groups',
        description: 'Join selling plan groups.',
        operation: { type: 'mutation', name: 'productJoinSellingPlanGroups' },
        requiredFlags: [flagId, flagGroupIds],
      },
      {
        verb: 'leave-selling-plan-groups',
        description: 'Leave selling plan groups.',
        operation: { type: 'mutation', name: 'productLeaveSellingPlanGroups' },
        requiredFlags: [flagId, flagGroupIds],
      },
      {
        verb: 'option-update',
        description: 'Update a product option.',
        operation: { type: 'mutation', name: 'productOptionUpdate' },
        requiredFlags: [flagProductId, flagOption],
        flags: [
          flagOptionValuesToAdd,
          flagOptionValuesToDelete,
          flagOptionValuesToUpdate,
          flagVariantStrategy,
        ],
      },
      {
        verb: 'options-create',
        description: 'Create product options.',
        operation: { type: 'mutation', name: 'productOptionsCreate' },
        requiredFlags: [flagProductId, flagOptions],
        flags: [flagVariantStrategy],
      },
      {
        verb: 'options-delete',
        description: 'Delete product options.',
        operation: { type: 'mutation', name: 'productOptionsDelete' },
        requiredFlags: [flagProductId, flagOptionIds],
        flags: [flagStrategy],
      },
      {
        verb: 'options-reorder',
        description: 'Reorder product options and values.',
        operation: { type: 'mutation', name: 'productOptionsReorder' },
        requiredFlags: [flagProductId, flagOptions],
      },
      {
        verb: 'combined-listing-update',
        description: 'Update a combined listing for a parent product.',
        operation: { type: 'mutation', name: 'combinedListingUpdate' },
        requiredFlags: [flagParentProductId],
        flags: [
          flagTitle,
          flagProductsAdded,
          flagProductsEdited,
          flagProductsRemovedIds,
          flagOptionsAndValues,
        ],
      },
      {
        verb: 'add-tags',
        description: 'Add tags to a product.',
        operation: { type: 'mutation', name: 'tagsAdd' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'remove-tags',
        description: 'Remove tags from a product.',
        operation: { type: 'mutation', name: 'tagsRemove' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'set-price',
        description: 'Set a variant price (and optional compare-at price).',
        operation: { type: 'mutation', name: 'productVariantsBulkUpdate' },
        requiredFlags: [flagVariantId, flag('--price <amount>', 'Price amount')],
        flags: [
          flag('--compare-at-price <amount>', 'Compare-at price amount'),
          flagProductId,
        ],
        notes: ['--product-id is required in --dry-run mode.'],
      },
      {
        verb: 'publish',
        description: 'Publish a product to specific publications.',
        operation: { type: 'mutation', name: 'publishablePublish' },
        requiredFlags: [flagId],
        flags: [flagPublicationId, flagPublication, flagAt, flagNow],
        notes: ['Pass either --publication-id or --publication (name).'],
      },
      {
        verb: 'unpublish',
        description: 'Unpublish a product from specific publications.',
        operation: { type: 'mutation', name: 'publishableUnpublish' },
        requiredFlags: [flagId],
        flags: [flagPublicationId, flagPublication],
        notes: ['Pass either --publication-id or --publication (name).'],
      },
      {
        verb: 'publish-all',
        description: 'Publish a product to all publications.',
        operation: { type: 'mutation', name: 'publishablePublish' },
        requiredFlags: [flagId],
        flags: [flagAt, flagNow],
      },
      {
        verb: 'metafields upsert',
        description: 'Upsert product metafields.',
        operation: { type: 'mutation', name: 'metafieldsSet', inputArg: 'metafields' },
        input: { mode: 'set', arg: 'metafields', required: true },
        requiredFlags: [flagId],
        notes: ['Input can be a single object or { metafields: [...] }.'],
      },
      {
        verb: 'media add',
        description: 'Attach remote media URLs to a product.',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId, flagUrl],
        flags: [
          flagAlt,
          flagMediaType,
          flagFilesUploadWait,
          flagPollIntervalMs,
          flagTimeoutMs,
        ],
        notes: [
          'Alias: --media-content-type is accepted as --media-type.',
        ],
      },
      {
        verb: 'media upload',
        description: 'Upload local files as product media.',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId, flagFile],
        flags: [
          flagAlt,
          flagFilesUploadFilename,
          flagFilesUploadMimeType,
          flagMediaType,
          flagFilesUploadWait,
          flagPollIntervalMs,
          flagTimeoutMs,
        ],
        notes: [
          'To attach by URL, use `shop products media add --url ...`.',
          'Use --file - to read from stdin; requires --filename.',
          'Aliases: --content-type is accepted as --mime-type; --media-content-type is accepted as --media-type.',
        ],
      },
      {
        verb: 'media list',
        description: 'List media for a product.',
        operation: { type: 'query', name: 'product' },
        requiredFlags: [flagId],
        output: { pagination: true },
      },
      {
        verb: 'media remove',
        description: 'Remove media references from a product.',
        operation: { type: 'mutation', name: 'fileUpdate' },
        requiredFlags: [flagId, flagMediaId],
        notes: ['Repeat --media-id to remove multiple items.'],
      },
      {
        verb: 'media update',
        description: 'Update media metadata (alt text).',
        operation: { type: 'mutation', name: 'fileUpdate' },
        requiredFlags: [flagMediaId, flagAlt],
      },
      {
        verb: 'media reorder',
        description: 'Reorder a product’s media.',
        operation: { type: 'mutation', name: 'productReorderMedia' },
        requiredFlags: [flagId],
        flags: [flagMoves, flagMove],
        notes: ['Pass either --moves or one or more --move entries.'],
      },
      inputVerb({
        verb: 'bundle-create',
        description: 'Create a product bundle.',
        operation: 'productBundleCreate',
      }),
      inputVerb({
        verb: 'bundle-update',
        description: 'Update a product bundle.',
        operation: 'productBundleUpdate',
      }),
    ],
  },
  {
    resource: 'product-variants',
    description: 'Manage product variants.',
    verbs: [
      {
        verb: 'upsert',
        description: 'Create or update product variants in bulk.',
        input: { mode: 'set', required: true },
        requiredFlags: [flagProductId],
        flags: [flagAllowPartialUpdates, flagStrategy],
        notes: ['Input can be an array or { variants: [...] }.'],
      },
      getVerb({ operation: 'productVariant', description: 'Fetch a variant by ID.' }),
      {
        verb: 'get-by-identifier',
        description: 'Fetch a variant by identifier (product + sku/barcode).',
        operation: { type: 'query', name: 'productVariantByIdentifier' },
        flags: [flagProductId, flag('--sku <string>', 'SKU'), flag('--barcode <string>', 'Barcode')],
        output: { view: true, selection: true },
        notes: ['Provide --product-id plus --sku or --barcode, or pass --input.'],
      },
      {
        verb: 'by-identifier',
        description: 'Alias for get-by-identifier.',
        operation: { type: 'query', name: 'productVariantByIdentifier' },
        flags: [flagProductId, flag('--sku <string>', 'SKU'), flag('--barcode <string>', 'Barcode')],
        output: { view: true, selection: true },
        notes: ['Alias for `shop product-variants get-by-identifier`.'],
      },
      listVerb({ operation: 'productVariants', description: 'List product variants.' }),
      countVerb({ operation: 'productVariantsCount', description: 'Count product variants.', flags: [flagQuery] }),
      inputVerb({
        verb: 'bulk-create',
        description: 'Bulk create variants for a product.',
        operation: 'productVariantsBulkCreate',
        requiredFlags: [flagProductId],
        flags: [flagAllowPartialUpdates],
      }),
      inputVerb({
        verb: 'bulk-update',
        description: 'Bulk update variants for a product.',
        operation: 'productVariantsBulkUpdate',
        requiredFlags: [flagProductId],
        flags: [flagAllowPartialUpdates],
      }),
      {
        verb: 'bulk-delete',
        description: 'Bulk delete variants for a product.',
        operation: { type: 'mutation', name: 'productVariantsBulkDelete' },
        requiredFlags: [flagProductId, flagVariantIds],
        flags: [flagIds],
        notes: ['Use --variant-ids or --ids.'],
      },
      {
        verb: 'bulk-reorder',
        description: 'Reorder variants for a product.',
        operation: { type: 'mutation', name: 'productVariantsBulkReorder' },
        requiredFlags: [flagProductId, flagPositions],
      },
      {
        verb: 'append-media',
        description: 'Append media to a variant.',
        operation: { type: 'mutation', name: 'productVariantAppendMedia' },
        requiredFlags: [flagId],
        flags: [flagProductId, flagMediaIds, flagVariantMedia],
      },
      {
        verb: 'detach-media',
        description: 'Detach media from a variant.',
        operation: { type: 'mutation', name: 'productVariantDetachMedia' },
        requiredFlags: [flagId],
        flags: [flagProductId, flagMediaIds, flagVariantMedia],
      },
      {
        verb: 'join-selling-plans',
        description: 'Join selling plan groups.',
        operation: { type: 'mutation', name: 'productVariantJoinSellingPlanGroups' },
        requiredFlags: [flagId, flagGroupIds],
      },
      {
        verb: 'leave-selling-plans',
        description: 'Leave selling plan groups.',
        operation: { type: 'mutation', name: 'productVariantLeaveSellingPlanGroups' },
        requiredFlags: [flagId, flagGroupIds],
      },
      inputVerb({
        verb: 'update-relationships',
        description: 'Bulk update variant relationships.',
        operation: 'productVariantRelationshipBulkUpdate',
      }),
    ],
  },
  {
    resource: 'product-feeds',
    description: 'Manage product feeds.',
    verbs: [
      createVerb({ operation: 'productFeedCreate', inputArg: 'input', description: 'Create a product feed.' }),
      getVerb({ operation: 'productFeed', description: 'Fetch a product feed by ID.' }),
      listVerb({ operation: 'productFeeds', description: 'List product feeds.' }),
      deleteVerb({ operation: 'productFeedDelete', description: 'Delete a product feed.' }),
      {
        verb: 'full-sync',
        description: 'Run a full product sync for a product feed.',
        operation: { type: 'mutation', name: 'productFullSync' },
        requiredFlags: [flagId],
        flags: [flagUpdatedAtSince, flagBeforeUpdatedAt],
      },
    ],
  },
  {
    resource: 'resource-feedback',
    description: 'Manage resource feedback.',
    verbs: [
      {
        verb: 'product-get',
        description: 'Get product resource feedback for this app.',
        operation: { type: 'query', name: 'productResourceFeedback' },
        requiredFlags: [flagId],
      },
      {
        verb: 'product-bulk-create',
        description: 'Create resource feedback for multiple products.',
        operation: { type: 'mutation', name: 'bulkProductResourceFeedbackCreate' },
        requiredFlags: [flagInput],
        notes: ['--input must be a JSON array (up to 50 items).'],
      },
      {
        verb: 'shop-create',
        description: 'Create shop resource feedback for this app.',
        operation: { type: 'mutation', name: 'shopResourceFeedbackCreate', inputArg: 'input' },
        input: { mode: 'set', arg: 'input', required: true },
        flags: [...inputFlags],
      },
    ],
  },
  {
    resource: 'publishables',
    description: 'Publish/unpublish resources via the current channel.',
    verbs: [
      {
        verb: 'publish-to-current-channel',
        description: 'Publish a resource to the current channel (deprecated).',
        operation: { type: 'mutation', name: 'publishablePublishToCurrentChannel' },
        requiredFlags: [flagId],
        notes: ['--id must be a full gid://shopify/... publishable ID (e.g. Product or Collection).'],
      },
      {
        verb: 'unpublish-to-current-channel',
        description: 'Unpublish a resource from the current channel (deprecated).',
        operation: { type: 'mutation', name: 'publishableUnpublishToCurrentChannel' },
        requiredFlags: [flagId],
        notes: ['--id must be a full gid://shopify/... publishable ID (e.g. Product or Collection).'],
      },
    ],
  },
  {
    resource: 'collections',
    description: 'Manage collections.',
    verbs: [
      createVerb({ operation: 'collectionCreate', description: 'Create a collection.' }),
      getVerb({ operation: 'collection', description: 'Fetch a collection by ID.' }),
      {
        verb: 'by-handle',
        description: 'Fetch a collection by handle.',
        operation: { type: 'query', name: 'collectionByHandle' },
        requiredFlags: [flagHandle],
        output: { view: true, selection: true },
      },
      {
        verb: 'by-identifier',
        description: 'Fetch a collection by identifier.',
        operation: { type: 'query', name: 'collectionByIdentifier' },
        requiredFlags: [flagIdentifierJsonFile],
        output: { view: true, selection: true },
      },
      {
        verb: 'rules-conditions',
        description: 'List available smart collection rule conditions.',
        operation: { type: 'query', name: 'collectionRulesConditions' },
        output: { view: true, selection: true },
      },
      listVerb({ operation: 'collections', description: 'List collections.' }),
      countVerb({
        operation: 'collectionsCount',
        description: 'Count collections.',
        flags: [flagQuery, flagLimit],
      }),
      updateVerb({ operation: 'collectionUpdate', description: 'Update a collection.' }),
      deleteVerb({ operation: 'collectionDelete', description: 'Delete a collection.' }),
      duplicateVerb({
        operation: 'collectionDuplicate',
        description: 'Duplicate a collection.',
        flags: [flag('--copy-publications', 'Copy publication settings to the duplicate')],
      }),
      {
        verb: 'add-products',
        description: 'Add products to a collection.',
        operation: { type: 'mutation', name: 'collectionAddProductsV2' },
        requiredFlags: [flagId, flag('--product-id <gid>', 'Product IDs (repeatable or comma-separated)')],
      },
      {
        verb: 'remove-products',
        description: 'Remove products from a collection.',
        operation: { type: 'mutation', name: 'collectionRemoveProducts' },
        requiredFlags: [flagId, flag('--product-id <gid>', 'Product IDs (repeatable or comma-separated)')],
      },
      {
        verb: 'reorder-products',
        description: 'Reorder products within a collection.',
        operation: { type: 'mutation', name: 'collectionReorderProducts' },
        requiredFlags: [flagId],
        flags: [flagMoves, flagMove],
        notes: ['Pass either --moves or one or more --move entries.'],
      },
      {
        verb: 'list-products',
        description: 'List products in a collection.',
        operation: { type: 'query', name: 'products' },
        flags: [flagId, flagHandle, flagPublished],
        notes: [
          'Pass exactly one of --id or --handle.',
          'Supports the same flags as `shop products list`.',
        ],
        output: { view: true, selection: true, pagination: true },
        examples: [
          'shop collections list-products --id 123',
          'shop collections list-products --handle frontpage --published --format table',
        ],
      },
      {
        verb: 'publish',
        description: 'Publish a collection to publications.',
        operation: { type: 'mutation', name: 'collectionPublish' },
        requiredFlags: [flagId],
        flags: [flagPublicationId, flagPublication],
        notes: ['Pass either --publication-id or --publication (name).'],
      },
      {
        verb: 'unpublish',
        description: 'Unpublish a collection from publications.',
        operation: { type: 'mutation', name: 'collectionUnpublish' },
        requiredFlags: [flagId],
        flags: [flagPublicationId, flagPublication],
        notes: ['Pass either --publication-id or --publication (name).'],
      },
    ],
  },
  {
    resource: 'customers',
    description: 'Manage customers.',
    verbs: [
      createVerb({ operation: 'customerCreate', description: 'Create a customer.' }),
      getVerb({ operation: 'customer', description: 'Fetch a customer by ID.' }),
      {
        verb: 'by-identifier',
        description: 'Fetch a customer by identifier.',
        operation: { type: 'query', name: 'customerByIdentifier' },
        flags: [flagEmailAddress, flagPhoneNumber, flagIdentifierId, flagCustomId],
        notes: ['Pass exactly one of --email-address, --phone-number, --identifier-id, --custom-id.'],
        output: { view: true, selection: true },
      },
      listVerb({ operation: 'customers', description: 'List customers.' }),
      countVerb({
        operation: 'customersCount',
        description: 'Count customers.',
        flags: [flagQuery, flagLimit],
      }),
      {
        verb: 'set',
        description: 'Create or update a customer (upsert).',
        operation: { type: 'mutation', name: 'customerSet' },
        requiredFlags: [],
        flags: [...inputFlags, flagIdentifier],
        notes: ['Input is CustomerSetInput JSON. Optionally pass --identifier (CustomerSetIdentifiers JSON).'],
      },
      updateVerb({ operation: 'customerUpdate', description: 'Update a customer.' }),
      deleteVerb({ operation: 'customerDelete', description: 'Delete a customer.' }),
      {
        verb: 'address-create',
        description: 'Create a customer address.',
        operation: { type: 'mutation', name: 'customerAddressCreate' },
        requiredFlags: [flagId, flagAddress],
        flags: [flagSetAsDefault],
      },
      {
        verb: 'address-update',
        description: 'Update a customer address.',
        operation: { type: 'mutation', name: 'customerAddressUpdate' },
        requiredFlags: [flagId, flagAddressId, flagAddress],
        flags: [flagSetAsDefault],
      },
      {
        verb: 'address-delete',
        description: 'Delete a customer address.',
        operation: { type: 'mutation', name: 'customerAddressDelete' },
        requiredFlags: [flagId, flagAddressId],
      },
      {
        verb: 'update-default-address',
        description: 'Update a customer’s default address.',
        operation: { type: 'mutation', name: 'customerUpdateDefaultAddress' },
        requiredFlags: [flagId, flagAddressId],
      },
      {
        verb: 'email-marketing-consent-update',
        description: 'Update a customer’s email marketing consent.',
        operation: { type: 'mutation', name: 'customerEmailMarketingConsentUpdate' },
        requiredFlags: [flagId, flagEmailMarketingConsent],
      },
      {
        verb: 'sms-marketing-consent-update',
        description: 'Update a customer’s SMS marketing consent.',
        operation: { type: 'mutation', name: 'customerSmsMarketingConsentUpdate' },
        requiredFlags: [flagId, flagSmsMarketingConsent],
      },
      {
        verb: 'add-tax-exemptions',
        description: 'Add tax exemptions to a customer.',
        operation: { type: 'mutation', name: 'customerAddTaxExemptions' },
        requiredFlags: [flagId, flagExemptions],
      },
      {
        verb: 'remove-tax-exemptions',
        description: 'Remove tax exemptions from a customer.',
        operation: { type: 'mutation', name: 'customerRemoveTaxExemptions' },
        requiredFlags: [flagId, flagExemptions],
      },
      {
        verb: 'replace-tax-exemptions',
        description: 'Replace tax exemptions on a customer.',
        operation: { type: 'mutation', name: 'customerReplaceTaxExemptions' },
        requiredFlags: [flagId, flagExemptions],
      },
      {
        verb: 'generate-account-activation-url',
        description: 'Generate a one-time account activation URL (legacy accounts).',
        operation: { type: 'mutation', name: 'customerGenerateAccountActivationUrl' },
        requiredFlags: [flagId],
      },
      {
        verb: 'request-data-erasure',
        description: 'Request erasure of a customer’s data.',
        operation: { type: 'mutation', name: 'customerRequestDataErasure' },
        requiredFlags: [flagId],
      },
      {
        verb: 'cancel-data-erasure',
        description: 'Cancel a pending customer data erasure request.',
        operation: { type: 'mutation', name: 'customerCancelDataErasure' },
        requiredFlags: [flagId],
      },
      {
        verb: 'metafields upsert',
        description: 'Upsert customer metafields.',
        operation: { type: 'mutation', name: 'metafieldsSet', inputArg: 'metafields' },
        input: { mode: 'set', arg: 'metafields', required: true },
        requiredFlags: [flagId],
        notes: ['Input can be a single object or { metafields: [...] }.'],
      },
      {
        verb: 'add-tags',
        description: 'Add tags to a customer.',
        operation: { type: 'mutation', name: 'tagsAdd' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'remove-tags',
        description: 'Remove tags from a customer.',
        operation: { type: 'mutation', name: 'tagsRemove' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'merge',
        description: 'Merge two customers.',
        operation: { type: 'mutation', name: 'customerMerge' },
        requiredFlags: [flagId, flag('--other-id <gid>', 'Other customer ID to merge into --id')],
        flags: [flag('--override-fields <json>', 'Override fields JSON (optional)')],
      },
      {
        verb: 'merge-preview',
        description: 'Preview a customer merge request.',
        operation: { type: 'query', name: 'customerMergePreview' },
        requiredFlags: [flagId, flag('--other-id <gid>', 'Other customer ID to merge into --id')],
        flags: [flag('--override-fields <json>', 'Override fields JSON (optional)')],
      },
      {
        verb: 'merge-job-status',
        description: 'Fetch customer merge job status.',
        operation: { type: 'query', name: 'customerMergeJobStatus' },
        requiredFlags: [flagJobId],
      },
      {
        verb: 'send-invite',
        description: 'Send a customer account invite email.',
        operation: { type: 'mutation', name: 'customerSendAccountInviteEmail' },
        requiredFlags: [flagId],
        flags: [flag('--email <json>', 'Email input JSON (optional)')],
      },
    ],
  },
  {
    resource: 'customer-privacy',
    description: 'Manage customer privacy and consent policies.',
    verbs: [
      {
        verb: 'privacy-settings',
        description: 'Fetch shop privacy settings.',
        operation: { type: 'query', name: 'privacySettings' },
      },
      {
        verb: 'privacy-features-disable',
        description: 'Disable shop privacy features.',
        operation: { type: 'mutation', name: 'privacyFeaturesDisable' },
        requiredFlags: [flagFeatures],
      },
      {
        verb: 'consent-policy',
        description: 'Fetch customer consent policies.',
        operation: { type: 'query', name: 'consentPolicy' },
        flags: [flagId, flagCountryCode, flagRegionCode, flagConsentRequired, flagDataSaleOptOutRequired],
      },
      {
        verb: 'consent-policy-regions',
        description: 'List available consent policy regions.',
        operation: { type: 'query', name: 'consentPolicyRegions' },
      },
      {
        verb: 'consent-policy-update',
        description: 'Update or create consent policies in bulk.',
        operation: { type: 'mutation', name: 'consentPolicyUpdate' },
        flags: [...inputFlags],
      },
      {
        verb: 'data-sale-opt-out',
        description: 'Opt out a customer from data sale.',
        operation: { type: 'mutation', name: 'dataSaleOptOut' },
        requiredFlags: [flagEmailAddress],
      },
    ],
  },
  {
    resource: 'customer-payment-methods',
    description: 'Manage vaulted customer payment methods.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a customer payment method by ID.',
        operation: { type: 'query', name: 'customerPaymentMethod' },
        requiredFlags: [flagId],
        flags: [flagShowRevoked],
        output: { view: true, selection: true },
      },
      {
        verb: 'credit-card-create',
        description: 'Create a credit card payment method for a customer.',
        operation: { type: 'mutation', name: 'customerPaymentMethodCreditCardCreate' },
        requiredFlags: [flagCustomerId, flagBillingAddress, flagSessionId],
      },
      {
        verb: 'credit-card-update',
        description: 'Update a credit card payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodCreditCardUpdate' },
        requiredFlags: [flagId, flagBillingAddress, flagSessionId],
      },
      {
        verb: 'paypal-billing-agreement-create',
        description: 'Create a PayPal billing agreement payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodPaypalBillingAgreementCreate' },
        requiredFlags: [flagCustomerId, flagBillingAgreementId],
        flags: [flagBillingAddress, flagInactive],
      },
      {
        verb: 'paypal-billing-agreement-update',
        description: 'Update a PayPal billing agreement payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodPaypalBillingAgreementUpdate' },
        requiredFlags: [flagId, flagBillingAddress],
      },
      {
        verb: 'remote-create',
        description: 'Import a remote payment method (Stripe, Authorize.Net, etc.).',
        operation: { type: 'mutation', name: 'customerPaymentMethodRemoteCreate' },
        requiredFlags: [flagCustomerId, flagRemoteReference],
      },
      {
        verb: 'revoke',
        description: 'Revoke a customer payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodRevoke' },
        requiredFlags: [flagId],
      },
      {
        verb: 'send-update-email',
        description: 'Send an update email link for a payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodSendUpdateEmail' },
        requiredFlags: [flagId],
        flags: [flag('--email <json>', 'Email input JSON (optional; only from/bcc are accepted)')],
      },
      {
        verb: 'duplication-data-get',
        description: 'Get encrypted duplication data for a payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodGetDuplicationData' },
        requiredFlags: [flagId, flagTargetCustomerId, flagTargetShopId],
      },
      {
        verb: 'duplication-create',
        description: 'Create a payment method from duplication data.',
        operation: { type: 'mutation', name: 'customerPaymentMethodCreateFromDuplicationData' },
        requiredFlags: [flagCustomerId, flagBillingAddress, flagEncryptedDuplicationData],
      },
      {
        verb: 'update-url-get',
        description: 'Get a customer-facing URL to update a payment method.',
        operation: { type: 'mutation', name: 'customerPaymentMethodGetUpdateUrl' },
        requiredFlags: [flagId],
      },
    ],
  },
  {
    resource: 'customer-segments',
    description: 'Query customer segment members and membership.',
    verbs: [
      {
        verb: 'members',
        description: 'List members of a segment or segment query.',
        operation: { type: 'query', name: 'customerSegmentMembers' },
        flags: [flagSegmentId, flagQueryId, flagTimezone],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'members-query',
        description: 'Fetch a customer segment members query by ID.',
        operation: { type: 'query', name: 'customerSegmentMembersQuery' },
        requiredFlags: [flagId],
      },
      {
        verb: 'membership',
        description: 'Check whether a customer is a member of segments.',
        operation: { type: 'query', name: 'customerSegmentMembership' },
        requiredFlags: [flagCustomerId, flagSegmentIds],
      },
      {
        verb: 'members-query-create',
        description: 'Create a customer segment members query.',
        operation: { type: 'mutation', name: 'customerSegmentMembersQueryCreate' },
        flags: [...inputFlags],
      },
    ],
  },
  {
    resource: 'orders',
    description: 'Manage orders.',
    verbs: [
      createVerb({ operation: 'orderCreate', description: 'Create an order.', inputArg: 'order' }),
      getVerb({ operation: 'order', description: 'Fetch an order by ID.' }),
      listVerb({ operation: 'orders', description: 'List orders.' }),
      countVerb({
        operation: 'ordersCount',
        description: 'Count orders.',
        flags: [flagQuery, flagLimit],
      }),
      updateVerb({ operation: 'orderUpdate', description: 'Update an order.' }),
      deleteVerb({ operation: 'orderDelete', description: 'Delete an order.' }),
      {
        verb: 'add-tags',
        description: 'Add tags to an order.',
        operation: { type: 'mutation', name: 'tagsAdd' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'remove-tags',
        description: 'Remove tags from an order.',
        operation: { type: 'mutation', name: 'tagsRemove' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'cancel',
        description: 'Cancel an order.',
        operation: { type: 'mutation', name: 'orderCancel' },
        requiredFlags: [flagId],
        flags: [
          flag('--refund', 'Issue refund'),
          flag('--restock <bool>', 'Restock items (default: true)'),
          flag('--refund-method <json>', 'Refund method input JSON (optional)'),
          flagReason,
          flagNotifyCustomer,
          flagStaffNote,
        ],
      },
      {
        verb: 'close',
        description: 'Close an order.',
        operation: { type: 'mutation', name: 'orderClose' },
        requiredFlags: [flagId],
      },
      {
        verb: 'mark-paid',
        description: 'Mark an order as paid.',
        operation: { type: 'mutation', name: 'orderMarkAsPaid' },
        requiredFlags: [flagId],
      },
      {
        verb: 'add-note',
        description: 'Add a note to an order.',
        operation: { type: 'mutation', name: 'orderUpdate' },
        requiredFlags: [flagId, flag('--note <string|@file>', 'Order note text')],
      },
      {
        verb: 'fulfill',
        description: 'Create fulfillments for an order.',
        operation: { type: 'mutation', name: 'fulfillmentCreateV2' },
        requiredFlags: [flagId],
        flags: [
          flag('--fulfillment-order-id <gid>', 'Fulfillment order ID (repeatable; defaults to all displayable)'),
          flagMessage,
          flagTrackingCompany,
          flagTrackingNumber,
          flagTrackingUrl,
          flagNotifyCustomer,
        ],
      },
      {
        verb: 'create-mandate-payment',
        description: 'Create a payment using a stored payment mandate.',
        operation: { type: 'mutation', name: 'orderCreateMandatePayment' },
        requiredFlags: [flagId, flagMandateId, flagIdempotencyKey],
        flags: [
          flagPaymentScheduleId,
          flag('--amount <json>', 'MoneyInput JSON (optional)'),
          flagAutoCapture,
        ],
      },
      {
        verb: 'transaction-void',
        description: 'Void an uncaptured authorization transaction.',
        operation: { type: 'mutation', name: 'transactionVoid' },
        requiredFlags: [flagParentTransactionId],
      },
      {
        verb: 'by-identifier',
        description: 'Fetch an order by identifier.',
        operation: { type: 'query', name: 'orderByIdentifier' },
        flags: [flagId, flagCustomIdNamespace, flagCustomIdKey, flagCustomIdValue],
        notes: ['Provide either --id or --custom-id-key/--custom-id-value (optionally with --custom-id-namespace).'],
        output: { view: true, selection: true },
      },
      {
        verb: 'pending-count',
        description: 'Get the count of pending orders.',
        operation: { type: 'query', name: 'pendingOrdersCount' },
      },
      {
        verb: 'payment-status',
        description: 'Get order payment status by payment reference ID.',
        operation: { type: 'query', name: 'orderPaymentStatus' },
        requiredFlags: [flagPaymentReferenceId],
        flags: [flagId, flagOrderId],
        notes: ['Use --order-id to specify the order; otherwise uses --id.'],
      },
      {
        verb: 'capture',
        description: 'Capture an authorized payment for an order.',
        operation: { type: 'mutation', name: 'orderCapture' },
        requiredFlags: [flagId, flagParentTransactionId, flagAmount, flagCurrency],
        flags: [flagFinalCapture],
      },
      {
        verb: 'create-manual-payment',
        description: 'Create a manual payment for an order.',
        operation: { type: 'mutation', name: 'orderCreateManualPayment' },
        requiredFlags: [flagId],
        flags: [flagAmount, flagCurrency, flagPaymentMethodName, flagProcessedAt],
        notes: ['If you pass --amount, you must also pass --currency.'],
      },
      {
        verb: 'invoice-send',
        description: 'Send an invoice for an order.',
        operation: { type: 'mutation', name: 'orderInvoiceSend' },
        requiredFlags: [flagId],
        flags: [flag('--email <json|@file>', 'Email input JSON (optional)')],
      },
      {
        verb: 'open',
        description: 'Open an order.',
        operation: { type: 'mutation', name: 'orderOpen' },
        requiredFlags: [flagId],
      },
      {
        verb: 'customer-set',
        description: 'Set a customer on an order.',
        operation: { type: 'mutation', name: 'orderCustomerSet' },
        requiredFlags: [flagId, flagCustomerId],
      },
      {
        verb: 'customer-remove',
        description: 'Remove the customer from an order.',
        operation: { type: 'mutation', name: 'orderCustomerRemove' },
        requiredFlags: [flagId],
      },
      {
        verb: 'risk-assessment-create',
        description: 'Create a risk assessment for an order.',
        operation: { type: 'mutation', name: 'orderRiskAssessmentCreate' },
        requiredFlags: [flagId, flagRiskLevel, flagFacts],
      },
    ],
  },
  {
    resource: 'tags',
    description: 'Add or remove tags on supported resources.',
    verbs: [
      {
        verb: 'add',
        description: 'Add tags to a resource by ID.',
        operation: { type: 'mutation', name: 'tagsAdd' },
        requiredFlags: [flagId, flagTags],
      },
      {
        verb: 'remove',
        description: 'Remove tags from a resource by ID.',
        operation: { type: 'mutation', name: 'tagsRemove' },
        requiredFlags: [flagId, flagTags],
      },
    ],
  },
  {
    resource: 'order-edit',
    description: 'Edit orders via the order-edit workflow.',
    verbs: [
      {
        verb: 'begin',
        description: 'Begin an order edit session.',
        operation: { type: 'mutation', name: 'orderEditBegin' },
        requiredFlags: [flagOrderId],
        output: { view: true, selection: true },
      },
      {
        verb: 'get',
        description: 'Get an order edit session by ID.',
        operation: { type: 'query', name: 'node' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'session',
        description: 'Get an order edit session by ID (orderEditSession).',
        operation: { type: 'query', name: 'orderEditSession' },
        requiredFlags: [flagId],
      },
      {
        verb: 'commit',
        description: 'Commit an order edit session.',
        operation: { type: 'mutation', name: 'orderEditCommit' },
        requiredFlags: [flagId],
        flags: [flagStaffNote, flagNotifyCustomer],
      },
      {
        verb: 'add-variant',
        description: 'Add a variant to the order edit.',
        operation: { type: 'mutation', name: 'orderEditAddVariant' },
        requiredFlags: [flagId, flagVariantId, flagQuantity],
        flags: [flagLocationId, flagAllowDuplicates],
        output: { view: true, selection: true },
      },
      {
        verb: 'add-custom-item',
        description: 'Add a custom item to the order edit.',
        operation: { type: 'mutation', name: 'orderEditAddCustomItem' },
        requiredFlags: [flagId, flagTitle, flagPrice, flagQuantity],
        flags: [flagTaxable, flagRequiresShipping, flagLocationId],
        output: { view: true, selection: true },
      },
      {
        verb: 'set-quantity',
        description: 'Set quantity for an order edit line item.',
        operation: { type: 'mutation', name: 'orderEditSetQuantity' },
        requiredFlags: [flagId, flagLineItemId, flagQuantity],
        flags: [flag('--restock', 'Restock inventory')],
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'add-discount',
        description: 'Add a discount to a line item.',
        operation: 'orderEditAddLineItemDiscount',
        requiredFlags: [flagId, flagLineItemId],
        inputArg: 'discount',
        output: { view: true, selection: true },
      }),
      {
        verb: 'remove-line-item-discount',
        description: 'Remove a line item discount from the order edit.',
        operation: { type: 'mutation', name: 'orderEditRemoveLineItemDiscount' },
        requiredFlags: [flagId, flagDiscountApplicationId],
        output: { view: true, selection: true },
      },
      {
        verb: 'remove-discount',
        description: 'Remove a discount from the order edit.',
        operation: { type: 'mutation', name: 'orderEditRemoveDiscount' },
        requiredFlags: [flagId, flagDiscountApplicationId],
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'update-discount',
        description: 'Update a discount for the order edit.',
        operation: 'orderEditUpdateDiscount',
        requiredFlags: [flagId, flagDiscountApplicationId],
        inputArg: 'discount',
        output: { view: true, selection: true },
      }),
      inputVerb({
        verb: 'add-shipping',
        description: 'Add a shipping line.',
        operation: 'orderEditAddShippingLine',
        requiredFlags: [flagId],
        inputArg: 'shippingLine',
        output: { view: true, selection: true },
      }),
      {
        verb: 'remove-shipping',
        description: 'Remove a shipping line.',
        operation: { type: 'mutation', name: 'orderEditRemoveShippingLine' },
        requiredFlags: [flagId, flagShippingLineId],
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'update-shipping',
        description: 'Update a shipping line.',
        operation: 'orderEditUpdateShippingLine',
        requiredFlags: [flagId, flagShippingLineId],
        inputArg: 'shippingLine',
        output: { view: true, selection: true },
      }),
    ],
  },
  {
    resource: 'inventory',
    description: 'Adjust inventory quantities.',
    verbs: [
      {
        verb: 'properties',
        description: 'Get inventory properties.',
        operation: { type: 'query', name: 'inventoryProperties' },
      },
      {
        verb: 'level',
        description: 'Fetch an inventory level by ID.',
        operation: { type: 'query', name: 'inventoryLevel' },
        requiredFlags: [flagId],
        notes: ['Pass an InventoryLevel ID via --id.'],
        output: { view: true, selection: true },
      },
      {
        verb: 'activate',
        description: 'Activate inventory at a location.',
        operation: { type: 'mutation', name: 'inventoryActivate' },
        requiredFlags: [flagLocationId],
        flags: [flagInventoryItemId, flagVariantId, flagAvailable, flagOnHand, flagStockAtLegacyLocation],
        notes: ['Pass either --inventory-item-id or --variant-id.'],
      },
      {
        verb: 'deactivate',
        description: 'Deactivate an inventory level.',
        operation: { type: 'mutation', name: 'inventoryDeactivate' },
        requiredFlags: [flagInventoryLevelId],
      },
      {
        verb: 'bulk-toggle-activation',
        description: 'Bulk toggle inventory activation.',
        operation: { type: 'mutation', name: 'inventoryBulkToggleActivation' },
        flags: [flagInventoryItemId, flagVariantId, flagUpdates, flagLocationId, flagActivate],
        notes: ['Pass either --inventory-item-id or --variant-id and either --updates or (--location-id and --activate).'],
      },
      {
        verb: 'set-on-hand-quantities',
        description: 'Set on-hand inventory quantities.',
        operation: { type: 'mutation', name: 'inventorySetOnHandQuantities' },
        flags: [
          flagInventoryItemId,
          flagVariantId,
          flagLocationId,
          flagOnHand,
          flag('--set-quantities <json|@file>', 'Set quantities JSON array'),
          flagReason,
          flagReferenceDocumentUri,
        ],
        notes: ['Provide --set-quantities, or provide --location-id and --on-hand (plus an item via --inventory-item-id or --variant-id).'],
      },
      {
        verb: 'set-scheduled-changes',
        description: 'Set scheduled inventory changes.',
        operation: { type: 'mutation', name: 'inventorySetScheduledChanges' },
        requiredFlags: [flagReferenceDocumentUri, flagItems],
        flags: [flagReason],
      },
      {
        verb: 'transfer-set-items',
        description: 'Set items for an inventory transfer.',
        operation: { type: 'mutation', name: 'inventoryTransferSetItems' },
        requiredFlags: [flagTransferId, flag('--line-items <json|@file>', 'Line items JSON array')],
      },
      {
        verb: 'list',
        description: 'List inventory levels at a location.',
        operation: { type: 'query', name: 'location' },
        requiredFlags: [flagLocationId],
        output: { pagination: true },
      },
      {
        verb: 'set',
        description: 'Set available inventory to an absolute quantity.',
        operation: { type: 'mutation', name: 'inventorySetQuantities' },
        requiredFlags: [flagLocationId, flag('--available <int>', 'Absolute available quantity')],
        flags: [flagInventoryItemId, flagVariantId, flagReason, flagReferenceDocumentUri],
        notes: ['Pass either --inventory-item-id or --variant-id.'],
      },
      {
        verb: 'adjust',
        description: 'Adjust available inventory by a delta.',
        operation: { type: 'mutation', name: 'inventoryAdjustQuantities' },
        requiredFlags: [flagLocationId, flag('--delta <int>', 'Quantity delta (positive or negative)')],
        flags: [flagInventoryItemId, flagVariantId, flagReason, flagReferenceDocumentUri],
        notes: ['Pass either --inventory-item-id or --variant-id.'],
      },
      {
        verb: 'move',
        description: 'Move inventory quantities between locations.',
        operation: { type: 'mutation', name: 'inventoryMoveQuantities' },
        requiredFlags: [flagFromLocationId, flagToLocationId, flagQuantity, flagReferenceDocumentUri],
        flags: [flagInventoryItemId, flagVariantId, flagReason, flagQuantityName],
        notes: ['Pass either --inventory-item-id or --variant-id.'],
      },
    ],
  },
  {
    resource: 'returns',
    description: 'Manage returns.',
    verbs: [
      getVerb({ operation: 'return', description: 'Fetch a return by ID.' }),
      {
        verb: 'reason-definitions',
        description: 'List return reason definitions.',
        operation: { type: 'query', name: 'returnReasonDefinitions' },
        flags: [flagIds, flagHandles],
        output: { pagination: true },
      },
      {
        verb: 'returnable-fulfillments',
        description: 'List returnable fulfillments for an order.',
        operation: { type: 'query', name: 'returnableFulfillments' },
        requiredFlags: [flagOrderId],
        output: { pagination: true },
      },
      {
        verb: 'calculate',
        description: 'Calculate a return.',
        operation: { type: 'query', name: 'returnCalculate', inputArg: 'input' },
        input: { mode: 'set', required: true },
        flags: [flagOrderId],
        notes: ['Requires orderId either via --order-id or input.orderId.'],
      },
      inputVerb({
        verb: 'create',
        description: 'Create a return.',
        operation: 'returnCreate',
        requiredFlags: [flagOrderId],
        flags: [flagNotifyCustomer],
        notes: ['orderId can be provided via --order-id or input.orderId.'],
      }),
      inputVerb({
        verb: 'request',
        description: 'Request a return.',
        operation: 'returnRequest',
        requiredFlags: [flagOrderId],
        notes: ['orderId can be provided via --order-id or input.orderId.'],
      }),
      {
        verb: 'approve-request',
        description: 'Approve a return request.',
        operation: { type: 'mutation', name: 'returnApproveRequest' },
        requiredFlags: [flagId],
        flags: [flagNotifyCustomer],
      },
      {
        verb: 'decline-request',
        description: 'Decline a return request.',
        operation: { type: 'mutation', name: 'returnDeclineRequest' },
        requiredFlags: [flagId, flagDeclineReason],
        flags: [flagDeclineNote, flagNotifyCustomer],
      },
      {
        verb: 'cancel',
        description: 'Cancel a return.',
        operation: { type: 'mutation', name: 'returnCancel' },
        requiredFlags: [flagId],
        flags: [flagNotifyCustomer],
      },
      {
        verb: 'close',
        description: 'Close a return.',
        operation: { type: 'mutation', name: 'returnClose' },
        requiredFlags: [flagId],
      },
      {
        verb: 'reopen',
        description: 'Reopen a return.',
        operation: { type: 'mutation', name: 'returnReopen' },
        requiredFlags: [flagId],
      },
      inputVerb({
        verb: 'process',
        description: 'Process a return.',
        operation: 'returnProcess',
        requiredFlags: [flagId],
        flags: [flagNotifyCustomer],
      }),
      inputVerb({
        verb: 'refund',
        description: 'Refund a return.',
        operation: 'returnRefund',
        inputArg: 'returnRefundInput',
        requiredFlags: [flagId],
        flags: [flagNotifyCustomer],
      }),
      {
        verb: 'remove-item',
        description: 'Remove an item from a return.',
        operation: { type: 'mutation', name: 'removeFromReturn' },
        requiredFlags: [flagId, flagReturnLineItemId, flagQuantity],
      },
      {
        verb: 'line-item-remove',
        description: 'Remove an item from a return (ReturnLineItem remove).',
        operation: { type: 'mutation', name: 'returnLineItemRemoveFromReturn' },
        requiredFlags: [flagId, flagReturnLineItemId, flagQuantity],
      },
    ],
  },
  {
    resource: 'returnable-fulfillments',
    description: 'Query returnable fulfillments.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a returnable fulfillment by ID.',
        operation: { type: 'query', name: 'returnableFulfillment' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
    ],
  },
  {
    resource: 'reverse-deliveries',
    description: 'Manage reverse deliveries.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a reverse delivery by ID.',
        operation: { type: 'query', name: 'reverseDelivery' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'create-with-shipping',
        description: 'Create a reverse delivery with shipping.',
        operation: { type: 'mutation', name: 'reverseDeliveryCreateWithShipping' },
        requiredFlags: [flagReverseFulfillmentOrderId, flagLineItem],
        flags: [flagTrackingNumber, flagTrackingUrl, flagLabelUrl, flagNotifyCustomer],
      },
      {
        verb: 'shipping-update',
        description: 'Update reverse delivery shipping.',
        operation: { type: 'mutation', name: 'reverseDeliveryShippingUpdate' },
        requiredFlags: [flagId],
        flags: [flagTrackingNumber, flagTrackingUrl, flagLabelUrl, flagNotifyCustomer],
      },
    ],
  },
  {
    resource: 'reverse-fulfillment-orders',
    description: 'Manage reverse fulfillment orders.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a reverse fulfillment order by ID.',
        operation: { type: 'query', name: 'reverseFulfillmentOrder' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'dispose',
        description: 'Dispose reverse fulfillment order line items.',
        operation: { type: 'mutation', name: 'reverseFulfillmentOrderDispose' },
        requiredFlags: [flagDisposition],
      },
    ],
  },
  {
    resource: 'fulfillment-orders',
    description: 'Manage fulfillment orders.',
    verbs: [
      getVerb({ operation: 'fulfillmentOrder', description: 'Fetch a fulfillment order by ID.' }),
      {
        ...listVerb({ operation: 'fulfillmentOrders', description: 'List fulfillment orders.' }),
        flags: [flagStatusValue, flag('--location-ids <gid>', 'Location IDs (repeatable)'), flag('--include-closed', 'Include closed fulfillment orders')],
      },
      {
        verb: 'assigned',
        description: 'List assigned fulfillment orders.',
        operation: { type: 'query', name: 'assignedFulfillmentOrders' },
        flags: [flagFirst, flagAfter, flagSort, flagReverse, flagAssignmentStatus, flagLocationIds],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'manual-holds',
        description: 'List fulfillment orders with manual holds.',
        operation: { type: 'query', name: 'manualHoldsFulfillmentOrders' },
        flags: [flagFirst, flagAfter, flagQuery, flagReverse],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'accept-request',
        description: 'Accept a fulfillment request.',
        operation: { type: 'mutation', name: 'fulfillmentOrderAcceptFulfillmentRequest' },
        requiredFlags: [flagId],
        flags: [flagMessage, flagEstimatedShippedAt],
      },
      {
        verb: 'reject-request',
        description: 'Reject a fulfillment request.',
        operation: { type: 'mutation', name: 'fulfillmentOrderRejectFulfillmentRequest' },
        requiredFlags: [flagId],
        flags: [flagMessage, flagReason],
      },
      {
        verb: 'submit-request',
        description: 'Submit a fulfillment request.',
        operation: { type: 'mutation', name: 'fulfillmentOrderSubmitFulfillmentRequest' },
        requiredFlags: [flagId],
        flags: [flagMessage, flagNotifyCustomer],
        input: { mode: 'set', required: false },
        notes: ['Input can include fulfillmentOrderLineItems.'],
      },
      {
        verb: 'accept-cancellation',
        description: 'Accept a cancellation request.',
        operation: { type: 'mutation', name: 'fulfillmentOrderAcceptCancellationRequest' },
        requiredFlags: [flagId],
        flags: [flagMessage],
      },
      {
        verb: 'reject-cancellation',
        description: 'Reject a cancellation request.',
        operation: { type: 'mutation', name: 'fulfillmentOrderRejectCancellationRequest' },
        requiredFlags: [flagId],
        flags: [flagMessage],
      },
      {
        verb: 'submit-cancellation',
        description: 'Submit a cancellation request.',
        operation: { type: 'mutation', name: 'fulfillmentOrderSubmitCancellationRequest' },
        requiredFlags: [flagId],
        flags: [flagMessage],
      },
      {
        verb: 'cancel',
        description: 'Cancel a fulfillment order.',
        operation: { type: 'mutation', name: 'fulfillmentOrderCancel' },
        requiredFlags: [flagId],
      },
      {
        verb: 'close',
        description: 'Close a fulfillment order.',
        operation: { type: 'mutation', name: 'fulfillmentOrderClose' },
        requiredFlags: [flagId],
        flags: [flagMessage],
      },
      {
        verb: 'open',
        description: 'Open a fulfillment order.',
        operation: { type: 'mutation', name: 'fulfillmentOrderOpen' },
        requiredFlags: [flagId],
      },
      {
        verb: 'hold',
        description: 'Place a fulfillment order on hold.',
        operation: { type: 'mutation', name: 'fulfillmentOrderHold' },
        requiredFlags: [flagId, flagReason],
        flags: [flagNotes],
      },
      {
        verb: 'release-hold',
        description: 'Release a fulfillment hold.',
        operation: { type: 'mutation', name: 'fulfillmentOrderReleaseHold' },
        requiredFlags: [flagId],
        flags: [flagHoldIds],
      },
      {
        verb: 'reschedule',
        description: 'Reschedule a fulfillment order.',
        operation: { type: 'mutation', name: 'fulfillmentOrderReschedule' },
        requiredFlags: [flagId, flagFulfillAt],
      },
      {
        verb: 'move',
        description: 'Move a fulfillment order to a new location.',
        operation: { type: 'mutation', name: 'fulfillmentOrderMove' },
        requiredFlags: [flagId, flagLocationId],
        input: { mode: 'set', required: false },
      },
      inputVerb({
        verb: 'split',
        description: 'Split a fulfillment order.',
        operation: 'fulfillmentOrderSplit',
      }),
      {
        verb: 'merge',
        description: 'Merge fulfillment orders.',
        operation: { type: 'mutation', name: 'fulfillmentOrderMerge' },
        flags: [flagIds],
        input: { mode: 'set', required: false },
        notes: ['Pass --ids or --input with fulfillmentOrderMergeInputs.'],
      },
      {
        verb: 'report-progress',
        description: 'Report progress on a fulfillment order.',
        operation: { type: 'mutation', name: 'fulfillmentOrderReportProgress' },
        requiredFlags: [flagId],
        flags: [flagMessage],
      },
      {
        verb: 'mark-prepared',
        description: 'Mark fulfillment order line items as prepared.',
        operation: { type: 'mutation', name: 'fulfillmentOrderLineItemsPreparedForPickup' },
        requiredFlags: [flagId],
        input: { mode: 'set', required: false },
      },
      {
        verb: 'set-deadline',
        description: 'Set fulfillment deadlines.',
        operation: { type: 'mutation', name: 'fulfillmentOrdersSetFulfillmentDeadline' },
        requiredFlags: [flagIds, flagDeadline],
      },
      {
        verb: 'reroute',
        description: 'Reroute fulfillment orders to a location.',
        operation: { type: 'mutation', name: 'fulfillmentOrdersReroute' },
        requiredFlags: [flagIds, flagLocationId],
      },
    ],
  },
  {
    resource: 'fulfillments',
    description: 'Manage fulfillments.',
    verbs: [
      getVerb({ operation: 'fulfillment', description: 'Fetch a fulfillment by ID.' }),
      inputVerb({
        verb: 'create',
        description: 'Create a fulfillment.',
        operation: 'fulfillmentCreateV2',
        requiredFlags: [],
        flags: [flagMessage],
        inputArg: 'fulfillment',
      }),
      inputVerb({
        verb: 'create-v1',
        description: 'Create a fulfillment (fulfillmentCreate).',
        operation: 'fulfillmentCreate',
        requiredFlags: [],
        flags: [flagMessage],
        inputArg: 'fulfillment',
      }),
      {
        verb: 'cancel',
        description: 'Cancel a fulfillment.',
        operation: { type: 'mutation', name: 'fulfillmentCancel' },
        requiredFlags: [flagId],
      },
      {
        verb: 'tracking-update',
        description: 'Update fulfillment tracking (fulfillmentTrackingInfoUpdate).',
        operation: { type: 'mutation', name: 'fulfillmentTrackingInfoUpdate' },
        requiredFlags: [flagId],
        flags: [flagTrackingCompany, flagTrackingNumber, flagTrackingUrl, flagNotifyCustomer],
      },
      {
        verb: 'update-tracking',
        description: 'Update fulfillment tracking.',
        operation: { type: 'mutation', name: 'fulfillmentTrackingInfoUpdateV2' },
        requiredFlags: [flagId],
        flags: [flagTrackingCompany, flagTrackingNumber, flagTrackingUrl, flagNotifyCustomer],
      },
      {
        verb: 'tracking-update-v2',
        description: 'Update fulfillment tracking (fulfillmentTrackingInfoUpdateV2).',
        operation: { type: 'mutation', name: 'fulfillmentTrackingInfoUpdateV2' },
        requiredFlags: [flagId],
        flags: [flagTrackingCompany, flagTrackingNumber, flagTrackingUrl, flagNotifyCustomer],
      },
      {
        verb: 'create-event',
        description: 'Create a fulfillment event.',
        operation: { type: 'mutation', name: 'fulfillmentEventCreate' },
        requiredFlags: [flagId, flagStatusValue],
        flags: [flagMessage, flagHappenedAt],
      },
    ],
  },
  {
    resource: 'inventory-items',
    description: 'Manage inventory items.',
    verbs: [
      getVerb({ operation: 'inventoryItem', description: 'Fetch an inventory item by ID.' }),
      listVerb({ operation: 'inventoryItems', description: 'List inventory items.' }),
      updateVerb({ operation: 'inventoryItemUpdate', description: 'Update an inventory item.' }),
    ],
  },
  {
    resource: 'inventory-shipments',
    description: 'Manage inventory shipments.',
    verbs: [
      getVerb({ operation: 'inventoryShipment', description: 'Fetch an inventory shipment by ID.' }),
      inputVerb({
        verb: 'create',
        description: 'Create an inventory shipment.',
        operation: 'inventoryShipmentCreate',
      }),
      inputVerb({
        verb: 'create-in-transit',
        description: 'Create an inventory shipment in transit.',
        operation: 'inventoryShipmentCreateInTransit',
      }),
      {
        verb: 'delete',
        description: 'Delete an inventory shipment.',
        operation: { type: 'mutation', name: 'inventoryShipmentDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'add-items',
        description: 'Add items to an inventory shipment.',
        operation: { type: 'mutation', name: 'inventoryShipmentAddItems' },
        requiredFlags: [flagId, flagItems],
      },
      {
        verb: 'remove-items',
        description: 'Remove items from an inventory shipment.',
        operation: { type: 'mutation', name: 'inventoryShipmentRemoveItems' },
        requiredFlags: [flagId, flagLineItemIds],
      },
      {
        verb: 'update-quantities',
        description: 'Update item quantities for an inventory shipment.',
        operation: { type: 'mutation', name: 'inventoryShipmentUpdateItemQuantities' },
        requiredFlags: [flagId, flagItems],
      },
      {
        verb: 'mark-in-transit',
        description: 'Mark an inventory shipment as in transit.',
        operation: { type: 'mutation', name: 'inventoryShipmentMarkInTransit' },
        requiredFlags: [flagId],
        flags: [flagDateShipped],
      },
      {
        verb: 'receive',
        description: 'Receive an inventory shipment.',
        operation: { type: 'mutation', name: 'inventoryShipmentReceive' },
        requiredFlags: [flagId],
        flags: [flagBulkReceiveAction, flagDateReceived, flagItems],
      },
      {
        verb: 'set-tracking',
        description: 'Set tracking for an inventory shipment.',
        operation: { type: 'mutation', name: 'inventoryShipmentSetTracking' },
        requiredFlags: [flagId, flagTracking],
      },
    ],
  },
  {
    resource: 'files',
    description: 'Upload files.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a file by ID.',
        operation: { type: 'query', name: 'files' },
        requiredFlags: [flagId],
      },
      {
        verb: 'list',
        description: 'List files.',
        operation: { type: 'query', name: 'files' },
        output: { pagination: true },
      },
      {
        verb: 'upload',
        description: 'Upload local files or URLs to Shopify.',
        operation: { type: 'mutation', name: 'fileCreate' },
        requiredFlags: [],
        flags: [
          flagFile,
          flagUrl,
          flagFilesUploadFilename,
          flagAlt,
          flagFilesUploadMimeType,
          flagFilesUploadMediaType,
          flagFilesUploadWait,
          flagPollIntervalMs,
          flagTimeoutMs,
        ],
        notes: [
          'Provide one or more --file or --url (but not both).',
          'Use --file - to read from stdin; requires --filename.',
          'Aliases: --resource and --content-type are accepted as --media-type.',
        ],
        examples: [
          'shop files upload --file ./cat.png',
          'shop files upload --url https://example.com/cat.png --wait',
          'shop files upload --url https://example.com/cat.png --filename kitten.png --mime-type image/png',
          'cat ./cat.png | shop files upload --file - --filename cat.png --mime-type image/png',
        ],
      },
      {
        verb: 'update',
        description: 'Update a file (alt text).',
        operation: { type: 'mutation', name: 'fileUpdate' },
        requiredFlags: [flagId, flagAlt],
      },
      {
        verb: 'acknowledge-update-failed',
        description: 'Acknowledge failed file updates.',
        operation: { type: 'mutation', name: 'fileAcknowledgeUpdateFailed' },
        requiredFlags: [flagId],
        flags: [flagId, flagIds],
        notes: ['Provide --id or --ids.'],
      },
      {
        verb: 'delete',
        description: 'Delete files.',
        operation: { type: 'mutation', name: 'fileDelete' },
        requiredFlags: [flagYes],
        flags: [flagId, flagIds],
        notes: ['Provide --id or --ids.'],
      },
    ],
  },
  {
    resource: 'publications',
    description: 'Manage publications.',
    verbs: [
      {
        verb: 'resolve',
        description: 'Resolve a publication ID by name or ID.',
        operation: { type: 'query', name: 'publications' },
        requiredFlags: [flag('--publication <name|gid|num>', 'Publication identifier')],
      },
      createVerb({ operation: 'publicationCreate', description: 'Create a publication.' }),
      getVerb({ operation: 'publication', description: 'Fetch a publication by ID.' }),
      listVerb({ operation: 'publications', description: 'List publications.' }),
      countVerb({
        operation: 'publicationsCount',
        description: 'Count publications.',
        flags: [flagType, flagLimit],
      }),
      {
        verb: 'published-products-count',
        description: 'Count published products for a publication.',
        operation: { type: 'query', name: 'publishedProductsCount' },
        requiredFlags: [flagPublicationId],
        flags: [flagLimit],
      },
      updateVerb({ operation: 'publicationUpdate', description: 'Update a publication.' }),
      deleteVerb({ operation: 'publicationDelete', description: 'Delete a publication.' }),
    ],
  },
  {
    resource: 'articles',
    description: 'Manage blog articles.',
    verbs: [
      {
        verb: 'authors',
        description: 'List article authors.',
        operation: { type: 'query', name: 'articleAuthors' },
        output: { pagination: true },
      },
      {
        verb: 'tags',
        description: 'List article tags.',
        operation: { type: 'query', name: 'articleTags' },
        requiredFlags: [flagLimit],
        flags: [flagSort, flagLimit],
      },
      createVerb({ operation: 'articleCreate', description: 'Create an article.' }),
      getVerb({ operation: 'article', description: 'Fetch an article by ID.' }),
      listVerb({ operation: 'articles', description: 'List articles.' }),
      updateVerb({ operation: 'articleUpdate', description: 'Update an article.' }),
      {
        verb: 'publish',
        description: 'Publish an article.',
        operation: { type: 'mutation', name: 'articleUpdate' },
        requiredFlags: [flagId],
        flags: [flagAt, flagNow],
      },
      {
        verb: 'unpublish',
        description: 'Unpublish an article.',
        operation: { type: 'mutation', name: 'articleUpdate' },
        requiredFlags: [flagId],
      },
      deleteVerb({ operation: 'articleDelete', description: 'Delete an article.' }),
    ],
  },
  {
    resource: 'blogs',
    description: 'Manage blogs.',
    verbs: [
      createVerb({ operation: 'blogCreate', description: 'Create a blog.' }),
      getVerb({ operation: 'blog', description: 'Fetch a blog by ID.' }),
      listVerb({ operation: 'blogs', description: 'List blogs.' }),
      {
        verb: 'count',
        description: 'Count blogs.',
        operation: { type: 'query', name: 'blogsCount' },
        flags: [flagQuery, flagLimit],
      },
      updateVerb({ operation: 'blogUpdate', description: 'Update a blog.' }),
      {
        verb: 'publish',
        description: 'Publish all articles in a blog.',
        operation: { type: 'mutation', name: 'articleUpdate' },
        requiredFlags: [flagId],
        flags: [flagAt, flagNow],
        notes: ['Not supported in --dry-run mode (requires pagination).'],
      },
      {
        verb: 'unpublish',
        description: 'Unpublish all articles in a blog.',
        operation: { type: 'mutation', name: 'articleUpdate' },
        requiredFlags: [flagId],
        notes: ['Not supported in --dry-run mode (requires pagination).'],
      },
      deleteVerb({ operation: 'blogDelete', description: 'Delete a blog.' }),
    ],
  },
  {
    resource: 'pages',
    description: 'Manage pages.',
    verbs: [
      createVerb({ operation: 'pageCreate', description: 'Create a page.' }),
      getVerb({ operation: 'page', description: 'Fetch a page by ID.' }),
      listVerb({ operation: 'pages', description: 'List pages.' }),
      {
        verb: 'count',
        description: 'Count pages.',
        operation: { type: 'query', name: 'pagesCount' },
        flags: [flagLimit],
      },
      updateVerb({ operation: 'pageUpdate', description: 'Update a page.' }),
      {
        verb: 'publish',
        description: 'Publish a page.',
        operation: { type: 'mutation', name: 'pageUpdate' },
        requiredFlags: [flagId],
        flags: [flagAt, flagNow],
      },
      {
        verb: 'unpublish',
        description: 'Unpublish a page.',
        operation: { type: 'mutation', name: 'pageUpdate' },
        requiredFlags: [flagId],
      },
      deleteVerb({ operation: 'pageDelete', description: 'Delete a page.' }),
    ],
  },
  {
    resource: 'comments',
    description: 'Manage comments.',
    verbs: [
      {
        verb: 'approve',
        description: 'Approve a comment.',
        operation: { type: 'mutation', name: 'commentApprove' },
        requiredFlags: [flagId],
      },
      {
        verb: 'spam',
        description: 'Mark a comment as spam.',
        operation: { type: 'mutation', name: 'commentSpam' },
        requiredFlags: [flagId],
      },
      {
        verb: 'not-spam',
        description: 'Mark a comment as not spam.',
        operation: { type: 'mutation', name: 'commentNotSpam' },
        requiredFlags: [flagId],
      },
      getVerb({ operation: 'comment', description: 'Fetch a comment by ID.' }),
      listVerb({ operation: 'comments', description: 'List comments.' }),
      deleteVerb({ operation: 'commentDelete', description: 'Delete a comment.' }),
    ],
  },
  {
    resource: 'menus',
    description: 'Manage navigation menus.',
    verbs: [
      {
        verb: 'create-basic',
        description: 'Create a menu (basic flags).',
        operation: { type: 'mutation', name: 'menuCreate' },
        requiredFlags: [flagTitle, flagHandle, flagItems],
        notes: ['--items must be a JSON array string.'],
      },
      {
        ...createVerb({ operation: 'menuCreate', description: 'Create a menu.' }),
        input: { mode: 'set', required: true },
        notes: ['Use --set title=..., --set handle=..., --set items=[...].'],
      },
      getVerb({ operation: 'menu', description: 'Fetch a menu by ID.' }),
      listVerb({ operation: 'menus', description: 'List menus.' }),
      {
        verb: 'update-basic',
        description: 'Update a menu (basic flags).',
        operation: { type: 'mutation', name: 'menuUpdate' },
        requiredFlags: [flagId, flagTitle, flagItems],
        flags: [flagHandle],
        notes: ['--items must be a JSON array string.'],
      },
      {
        ...updateVerb({ operation: 'menuUpdate', description: 'Update a menu.' }),
        input: { mode: 'set', required: true },
        notes: ['Use --set title=... and --set items=[...].'],
      },
      deleteVerb({ operation: 'menuDelete', description: 'Delete a menu.' }),
    ],
  },
  {
    resource: 'catalogs',
    description: 'Manage catalogs.',
    verbs: [
      createVerb({ operation: 'catalogCreate', description: 'Create a catalog.' }),
      getVerb({ operation: 'catalog', description: 'Fetch a catalog by ID.' }),
      listVerb({ operation: 'catalogs', description: 'List catalogs.' }),
      countVerb({
        operation: 'catalogsCount',
        description: 'Count catalogs.',
        flags: [flagQuery, flagLimit, flagType],
      }),
      {
        verb: 'operations',
        description: 'Fetch recent catalog operations.',
        operation: { type: 'query', name: 'catalogOperations' },
        output: { view: true, selection: true },
      },
      {
        verb: 'context-update',
        description: 'Update catalog contexts (markets, company locations, etc).',
        operation: { type: 'mutation', name: 'catalogContextUpdate' },
        requiredFlags: [flagCatalogId],
        flags: [flagContextsToAdd, flagContextsToRemove],
        notes: ['Pass --contexts-to-add and/or --contexts-to-remove.'],
      },
      updateVerb({ operation: 'catalogUpdate', description: 'Update a catalog.' }),
      deleteVerb({ operation: 'catalogDelete', description: 'Delete a catalog.' }),
    ],
  },
  {
    resource: 'markets',
    description: 'Manage markets.',
    verbs: [
      createVerb({ operation: 'marketCreate', description: 'Create a market.' }),
      getVerb({ operation: 'market', description: 'Fetch a market by ID.' }),
      listVerb({ operation: 'markets', description: 'List markets.' }),
      {
        verb: 'by-geography',
        description: 'Resolve the applicable market for a country.',
        operation: { type: 'query', name: 'marketByGeography' },
        requiredFlags: [flagCountryCode],
        output: { view: true, selection: true },
      },
      {
        verb: 'primary',
        description: 'Fetch the primary market.',
        operation: { type: 'query', name: 'primaryMarket' },
        output: { view: true, selection: true },
      },
      {
        verb: 'resolved-values',
        description: 'Resolve values for buyer signals (currency, catalogs, web presences).',
        operation: { type: 'query', name: 'marketsResolvedValues' },
        requiredFlags: [flagCountryCode],
      },
      updateVerb({ operation: 'marketUpdate', description: 'Update a market.' }),
      deleteVerb({ operation: 'marketDelete', description: 'Delete a market.' }),
      inputVerb({
        verb: 'currency-settings-update',
        description: 'Update market currency settings (deprecated API).',
        operation: 'marketCurrencySettingsUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'regions-create',
        description: 'Create regions for a market (deprecated API).',
        operation: { type: 'mutation', name: 'marketRegionsCreate' },
        requiredFlags: [flagId, flagCountryCodes],
      },
      {
        verb: 'regions-delete',
        description: 'Delete regions (deprecated API).',
        operation: { type: 'mutation', name: 'marketRegionsDelete' },
        requiredFlags: [flagIds, flagYes],
      },
      {
        verb: 'region-delete',
        description: 'Delete a market region (deprecated API).',
        operation: { type: 'mutation', name: 'marketRegionDelete' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'market-localizations',
    description: 'Manage market localizations (per-market localized values).',
    verbs: [
      {
        verb: 'localizable-resource',
        description: 'Fetch a market localizable resource by ID.',
        operation: { type: 'query', name: 'marketLocalizableResource' },
        requiredFlags: [flagResourceId, flagMarketId],
        output: { view: true, selection: true },
      },
      {
        verb: 'localizable-resources',
        description: 'List market localizable resources by type.',
        operation: { type: 'query', name: 'marketLocalizableResources' },
        requiredFlags: [flagResourceType, flagMarketId],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'localizable-resources-by-ids',
        description: 'List market localizable resources by IDs.',
        operation: { type: 'query', name: 'marketLocalizableResourcesByIds' },
        requiredFlags: [flagResourceIds, flagMarketId],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'register',
        description: 'Create or update market localizations.',
        operation: { type: 'mutation', name: 'marketLocalizationsRegister' },
        requiredFlags: [flagResourceId],
        input: { mode: 'set', required: true },
      },
      {
        verb: 'remove',
        description: 'Delete market localizations.',
        operation: { type: 'mutation', name: 'marketLocalizationsRemove' },
        requiredFlags: [flagResourceId, flagMarketIds, flagKeys],
      },
    ],
  },
  {
    resource: 'market-web-presences',
    description: 'Manage market web presences (deprecated API).',
    verbs: [
      {
        verb: 'create',
        description: 'Create a web presence for a market.',
        operation: { type: 'mutation', name: 'marketWebPresenceCreate' },
        requiredFlags: [flagMarketId],
        input: { mode: 'set', required: true },
      },
      {
        verb: 'update',
        description: 'Update a market web presence.',
        operation: { type: 'mutation', name: 'marketWebPresenceUpdate' },
        requiredFlags: [flagId],
        input: { mode: 'set', required: true },
      },
      {
        verb: 'delete',
        description: 'Delete a market web presence.',
        operation: { type: 'mutation', name: 'marketWebPresenceDelete' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'draft-orders',
    description: 'Manage draft orders.',
    verbs: [
      getVerb({ operation: 'draftOrder', description: 'Fetch a draft order by ID.' }),
      listVerb({ operation: 'draftOrders', description: 'List draft orders.' }),
      countVerb({ operation: 'draftOrdersCount', description: 'Count draft orders.', flags: [flagQuery] }),
      createVerb({ operation: 'draftOrderCreate', description: 'Create a draft order.' }),
      updateVerb({ operation: 'draftOrderUpdate', description: 'Update a draft order.' }),
      deleteVerb({ operation: 'draftOrderDelete', description: 'Delete a draft order.' }),
      duplicateVerb({ operation: 'draftOrderDuplicate', description: 'Duplicate a draft order.' }),
      inputVerb({ verb: 'calculate', description: 'Calculate a draft order without saving.', operation: 'draftOrderCalculate', inputArg: 'input' }),
      {
        verb: 'complete',
        description: 'Complete a draft order.',
        operation: { type: 'mutation', name: 'draftOrderComplete' },
        requiredFlags: [flagId],
      },
      {
        verb: 'create-from-order',
        description: 'Create a draft order from an order.',
        operation: { type: 'mutation', name: 'draftOrderCreateFromOrder' },
        requiredFlags: [flagOrderId],
      },
      inputVerb({
        verb: 'preview-invoice',
        description: 'Preview a draft order invoice.',
        operation: 'draftOrderInvoicePreview',
        requiredFlags: [flagId],
        inputArg: 'email',
        inputRequired: false,
      }),
      inputVerb({
        verb: 'send-invoice',
        description: 'Send a draft order invoice.',
        operation: 'draftOrderInvoiceSend',
        requiredFlags: [flagId],
        inputArg: 'email',
        inputRequired: false,
      }),
      {
        verb: 'bulk-add-tags',
        description: 'Bulk add tags to draft orders.',
        operation: { type: 'mutation', name: 'draftOrderBulkAddTags' },
        requiredFlags: [flagIds, flagTags],
      },
      {
        verb: 'bulk-remove-tags',
        description: 'Bulk remove tags from draft orders.',
        operation: { type: 'mutation', name: 'draftOrderBulkRemoveTags' },
        requiredFlags: [flagIds, flagTags],
      },
      {
        verb: 'bulk-delete',
        description: 'Bulk delete draft orders.',
        operation: { type: 'mutation', name: 'draftOrderBulkDelete' },
        requiredFlags: [flagIds, flagYes],
      },
      {
        verb: 'saved-searches',
        description: 'List saved searches for draft orders.',
        operation: { type: 'query', name: 'draftOrderSavedSearches' },
        output: { pagination: true },
      },
      {
        verb: 'tags',
        description: 'Fetch a draft order tag by ID.',
        operation: { type: 'query', name: 'draftOrderTag' },
        requiredFlags: [flagId],
      },
      inputVerb({
        verb: 'delivery-options',
        description: 'List available delivery options for a draft order.',
        operation: 'draftOrderAvailableDeliveryOptions',
        inputArg: 'input',
      }),
    ],
  },
  {
    resource: 'url-redirects',
    description: 'Manage URL redirects.',
    verbs: [
      createVerb({ operation: 'urlRedirectCreate', description: 'Create a URL redirect.' }),
      getVerb({ operation: 'urlRedirect', description: 'Fetch a URL redirect by ID.' }),
      listVerb({ operation: 'urlRedirects', description: 'List URL redirects.' }),
      countVerb({
        operation: 'urlRedirectsCount',
        description: 'Count URL redirects.',
        flags: [flagQuery, flagLimit, flagSavedSearchId],
      }),
      {
        verb: 'saved-searches',
        description: 'List URL redirect saved searches.',
        operation: { type: 'query', name: 'urlRedirectSavedSearches' },
        output: { pagination: true },
      },
      {
        verb: 'import-create',
        description: 'Create a URL redirect import from a staged upload URL.',
        operation: { type: 'mutation', name: 'urlRedirectImportCreate' },
        requiredFlags: [flagUrl],
      },
      {
        verb: 'import-submit',
        description: 'Submit a URL redirect import for processing.',
        operation: { type: 'mutation', name: 'urlRedirectImportSubmit' },
        requiredFlags: [flagId],
      },
      {
        verb: 'import-get',
        description: 'Fetch a URL redirect import by ID.',
        operation: { type: 'query', name: 'urlRedirectImport' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'bulk-delete-all',
        description: 'Bulk delete all URL redirects.',
        operation: { type: 'mutation', name: 'urlRedirectBulkDeleteAll' },
        requiredFlags: [flagYes],
      },
      {
        verb: 'bulk-delete-ids',
        description: 'Bulk delete URL redirects by IDs.',
        operation: { type: 'mutation', name: 'urlRedirectBulkDeleteByIds' },
        requiredFlags: [flagIds, flagYes],
      },
      {
        verb: 'bulk-delete-saved-search',
        description: 'Bulk delete URL redirects by saved search.',
        operation: { type: 'mutation', name: 'urlRedirectBulkDeleteBySavedSearch' },
        requiredFlags: [flagSavedSearchId, flagYes],
      },
      {
        verb: 'bulk-delete-search',
        description: 'Bulk delete URL redirects by search string.',
        operation: { type: 'mutation', name: 'urlRedirectBulkDeleteBySearch' },
        requiredFlags: [flagSearch, flagYes],
      },
      updateVerb({ operation: 'urlRedirectUpdate', description: 'Update a URL redirect.' }),
      deleteVerb({ operation: 'urlRedirectDelete', description: 'Delete a URL redirect.' }),
    ],
  },
  {
    resource: 'segments',
    description: 'Manage customer segments.',
    verbs: [
      createVerb({ operation: 'segmentCreate', description: 'Create a segment.' }),
      getVerb({ operation: 'segment', description: 'Fetch a segment by ID.' }),
      listVerb({ operation: 'segments', description: 'List segments.' }),
      countVerb({ operation: 'segmentsCount', description: 'Count segments.', flags: [flagLimit] }),
      {
        verb: 'filters',
        description: 'List available segment filters.',
        operation: { type: 'query', name: 'segmentFilters' },
        output: { pagination: true },
      },
      {
        verb: 'filter-suggestions',
        description: 'List segment filter suggestions for a search term.',
        operation: { type: 'query', name: 'segmentFilterSuggestions' },
        requiredFlags: [flagSearch],
        output: { pagination: true },
      },
      {
        verb: 'value-suggestions',
        description: 'List segment value suggestions for a search term.',
        operation: { type: 'query', name: 'segmentValueSuggestions' },
        requiredFlags: [flagSearch],
        flags: [flagFilterQueryName, flagFunctionParameterQueryName],
        output: { pagination: true },
      },
      {
        verb: 'migrations',
        description: 'List segment migrations.',
        operation: { type: 'query', name: 'segmentMigrations' },
        flags: [flagSavedSearchId],
        output: { pagination: true },
      },
      updateVerb({ operation: 'segmentUpdate', description: 'Update a segment.' }),
      deleteVerb({ operation: 'segmentDelete', description: 'Delete a segment.' }),
    ],
  },
  {
    resource: 'saved-searches',
    description: 'Manage saved searches.',
    verbs: [
      inputVerb({
        verb: 'create',
        description: 'Create a saved search.',
        operation: 'savedSearchCreate',
        flags: [flagResourceType],
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a saved search.',
        operation: 'savedSearchUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
        notes: ['ID can be provided via --id or input.id.'],
      }),
      {
        verb: 'delete',
        description: 'Delete a saved search.',
        operation: { type: 'mutation', name: 'savedSearchDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'list-products',
        description: 'List saved searches for products.',
        operation: { type: 'query', name: 'productSavedSearches' },
        output: { pagination: true },
      },
      {
        verb: 'list-orders',
        description: 'List saved searches for orders.',
        operation: { type: 'query', name: 'orderSavedSearches' },
        output: { pagination: true },
      },
      {
        verb: 'list-customers',
        description: 'List saved searches for customers.',
        operation: { type: 'query', name: 'customerSavedSearches' },
        output: { pagination: true },
      },
      {
        verb: 'list-draft-orders',
        description: 'List saved searches for draft orders.',
        operation: { type: 'query', name: 'draftOrderSavedSearches' },
        output: { pagination: true },
      },
      {
        verb: 'list-collections',
        description: 'List saved searches for collections.',
        operation: { type: 'query', name: 'collectionSavedSearches' },
        output: { pagination: true },
      },
    ],
  },
  {
    resource: 'script-tags',
    description: 'Manage script tags.',
    verbs: [
      createVerb({ operation: 'scriptTagCreate', description: 'Create a script tag.' }),
      getVerb({ operation: 'scriptTag', description: 'Fetch a script tag by ID.' }),
      listVerb({ operation: 'scriptTags', description: 'List script tags.' }),
      updateVerb({ operation: 'scriptTagUpdate', description: 'Update a script tag.' }),
      deleteVerb({ operation: 'scriptTagDelete', description: 'Delete a script tag.' }),
    ],
  },
  {
    resource: 'carrier-services',
    description: 'Manage carrier services.',
    verbs: [
      createVerb({ operation: 'carrierServiceCreate', description: 'Create a carrier service.' }),
      getVerb({ operation: 'carrierService', description: 'Fetch a carrier service by ID.' }),
      listVerb({ operation: 'carrierServices', description: 'List carrier services.' }),
      {
        verb: 'list-available',
        description: 'List available carrier services.',
        operation: { type: 'query', name: 'availableCarrierServices' },
      },
      updateVerb({ operation: 'carrierServiceUpdate', description: 'Update a carrier service.' }),
      deleteVerb({ operation: 'carrierServiceDelete', description: 'Delete a carrier service.' }),
    ],
  },
  {
    resource: 'webhooks',
    description: 'Manage webhook subscriptions.',
    verbs: [
      {
        verb: 'count',
        description: 'Count webhook subscriptions.',
        operation: { type: 'query', name: 'webhookSubscriptionsCount' },
        flags: [flagQuery, flagLimit],
      },
      inputVerb({
        verb: 'create',
        description: 'Create a webhook subscription.',
        operation: 'webhookSubscriptionCreate',
        inputArg: 'webhookSubscription',
        requiredFlags: [flagTopic],
      }),
      getVerb({ operation: 'webhookSubscription', description: 'Fetch a webhook subscription by ID.' }),
      listVerb({ operation: 'webhookSubscriptions', description: 'List webhook subscriptions.' }),
      inputVerb({
        verb: 'update',
        description: 'Update a webhook subscription.',
        operation: 'webhookSubscriptionUpdate',
        inputArg: 'webhookSubscription',
        requiredFlags: [flagId],
      }),
      {
        verb: 'pubsub-create',
        description: 'Create a Pub/Sub webhook subscription.',
        operation: { type: 'mutation', name: 'pubSubWebhookSubscriptionCreate' },
        requiredFlags: [flagTopic, flagPubSubProject, flagPubSubTopic],
        flags: inputFlags,
        output: { view: true, selection: true },
      },
      {
        verb: 'pubsub-update',
        description: 'Update a Pub/Sub webhook subscription.',
        operation: { type: 'mutation', name: 'pubSubWebhookSubscriptionUpdate' },
        requiredFlags: [flagId, flagPubSubProject, flagPubSubTopic],
        flags: inputFlags,
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'event-bridge-create',
        description: 'Create an EventBridge webhook subscription.',
        operation: 'eventBridgeWebhookSubscriptionCreate',
        inputArg: 'webhookSubscription',
        requiredFlags: [flagTopic],
      }),
      inputVerb({
        verb: 'event-bridge-update',
        description: 'Update an EventBridge webhook subscription.',
        operation: 'eventBridgeWebhookSubscriptionUpdate',
        inputArg: 'webhookSubscription',
        requiredFlags: [flagId],
      }),
      deleteVerb({ operation: 'webhookSubscriptionDelete', description: 'Delete a webhook subscription.' }),
    ],
  },
  {
    resource: 'subscription-contracts',
    description: 'Manage subscription contracts.',
    verbs: [
      getVerb({ operation: 'subscriptionContract', description: 'Fetch a subscription contract by ID.' }),
      listVerb({ operation: 'subscriptionContracts', description: 'List subscription contracts.' }),
      inputVerb({
        verb: 'create',
        description: 'Create a subscription contract draft.',
        operation: 'subscriptionContractCreate',
        flags: [flagCustomerId],
      }),
      inputVerb({
        verb: 'atomic-create',
        description: 'Atomically create a subscription contract.',
        operation: 'subscriptionContractAtomicCreate',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a subscription contract (via draft).',
        operation: 'subscriptionContractUpdate',
        requiredFlags: [flagId],
        inputRequired: false,
        notes: ['If no input is provided, returns a draft ID.'],
      }),
      {
        verb: 'activate',
        description: 'Activate a subscription contract.',
        operation: { type: 'mutation', name: 'subscriptionContractActivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'pause',
        description: 'Pause a subscription contract.',
        operation: { type: 'mutation', name: 'subscriptionContractPause' },
        requiredFlags: [flagId],
      },
      {
        verb: 'cancel',
        description: 'Cancel a subscription contract.',
        operation: { type: 'mutation', name: 'subscriptionContractCancel' },
        requiredFlags: [flagId],
      },
      {
        verb: 'expire',
        description: 'Expire a subscription contract.',
        operation: { type: 'mutation', name: 'subscriptionContractExpire' },
        requiredFlags: [flagId],
      },
      {
        verb: 'fail',
        description: 'Fail a subscription contract.',
        operation: { type: 'mutation', name: 'subscriptionContractFail' },
        requiredFlags: [flagId],
      },
      {
        verb: 'set-next-billing',
        description: 'Set the next billing date.',
        operation: { type: 'mutation', name: 'subscriptionContractSetNextBillingDate' },
        requiredFlags: [flagId, flagDate],
      },
      inputVerb({
        verb: 'change-product',
        description: 'Change the product for a subscription line.',
        operation: 'subscriptionContractProductChange',
        requiredFlags: [flagId, flagLineId],
      }),
    ],
  },
  {
    resource: 'subscription-billing',
    description: 'Manage subscription billing cycles and attempts.',
    verbs: [
      {
        verb: 'get-attempt',
        description: 'Fetch a billing attempt by ID.',
        operation: { type: 'query', name: 'subscriptionBillingAttempt' },
        requiredFlags: [flagId],
      },
      {
        verb: 'list-attempts',
        description: 'List billing attempts for a contract.',
        operation: { type: 'query', name: 'subscriptionContract' },
        requiredFlags: [flagContractId],
        output: { pagination: true },
      },
      inputVerb({
        verb: 'create-attempt',
        description: 'Create a billing attempt.',
        operation: 'subscriptionBillingAttemptCreate',
        requiredFlags: [flagContractId],
        inputArg: 'subscriptionBillingAttemptInput',
      }),
      {
        verb: 'get-cycle',
        description: 'Fetch a billing cycle.',
        operation: { type: 'query', name: 'subscriptionBillingCycle' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      {
        verb: 'list-cycles',
        description: 'List billing cycles.',
        operation: { type: 'query', name: 'subscriptionBillingCycles' },
        requiredFlags: [flagContractId],
        output: { pagination: true },
      },
      {
        verb: 'charge',
        description: 'Charge a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleCharge' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      inputVerb({
        verb: 'bulk-charge',
        description: 'Bulk charge billing cycles.',
        operation: 'subscriptionBillingCycleBulkCharge',
        inputRequired: true,
      }),
      inputVerb({
        verb: 'bulk-search',
        description: 'Bulk search billing cycles.',
        operation: 'subscriptionBillingCycleBulkSearch',
        inputRequired: true,
      }),
      {
        verb: 'skip-cycle',
        description: 'Skip a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleSkip' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      {
        verb: 'unskip-cycle',
        description: 'Unskip a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleUnskip' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      inputVerb({
        verb: 'edit-schedule',
        description: 'Edit billing cycle schedule.',
        operation: 'subscriptionBillingCycleScheduleEdit',
        requiredFlags: [flagContractId, flagCycleIndex],
      }),
      inputVerb({
        verb: 'edit-cycle',
        description: 'Edit a billing cycle (via draft).',
        operation: 'subscriptionBillingCycleContractEdit',
        requiredFlags: [flagContractId, flagCycleIndex],
        inputRequired: false,
      }),
      {
        verb: 'delete-edits',
        description: 'Delete billing cycle edits.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleEditDelete' },
        requiredFlags: [flagContractId, flagCycleIndexes],
      },
    ],
  },
  {
    resource: 'subscription-billing-cycles',
    description: 'Query and manage subscription billing cycles (root APIs).',
    verbs: [
      {
        verb: 'attempts',
        description: 'List subscription billing attempts on the store.',
        operation: { type: 'query', name: 'subscriptionBillingAttempts' },
        output: { pagination: true },
      },
      {
        verb: 'bulk-results',
        description: 'Fetch results for a billing cycle bulk job.',
        operation: { type: 'query', name: 'subscriptionBillingCycleBulkResults' },
        requiredFlags: [flagJobId],
        output: { pagination: true },
      },
      {
        verb: 'get',
        description: 'Fetch a billing cycle by contract and cycle index.',
        operation: { type: 'query', name: 'subscriptionBillingCycle' },
        requiredFlags: [flagContractId, flagCycleIndex],
        output: { view: true, selection: true },
      },
      {
        verb: 'charge',
        description: 'Charge a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleCharge' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      {
        verb: 'skip',
        description: 'Skip a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleSkip' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      {
        verb: 'unskip',
        description: 'Unskip a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleUnskip' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      inputVerb({
        verb: 'schedule-edit',
        description: 'Modify the schedule of a specific billing cycle.',
        operation: 'subscriptionBillingCycleScheduleEdit',
        requiredFlags: [flagContractId, flagCycleIndex],
      }),
      {
        verb: 'contract-edit',
        description: 'Create a subscription contract draft for a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleContractEdit' },
        requiredFlags: [flagContractId, flagCycleIndex],
      },
      {
        verb: 'contract-draft-commit',
        description: 'Commit a subscription billing cycle contract draft.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleContractDraftCommit' },
        requiredFlags: [flagDraftId],
      },
      inputVerb({
        verb: 'contract-draft-concatenate',
        description: 'Concatenate contracts to a subscription draft.',
        operation: 'subscriptionBillingCycleContractDraftConcatenate',
        requiredFlags: [flagDraftId],
      }),
      {
        verb: 'edit-delete',
        description: 'Delete schedule and contract edits of a billing cycle.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleEditDelete' },
        requiredFlags: [flagContractId, flagCycleIndex, flagYes],
      },
      {
        verb: 'edits-delete',
        description: 'Delete current and future schedule/contract edits for a contract.',
        operation: { type: 'mutation', name: 'subscriptionBillingCycleEditsDelete' },
        requiredFlags: [flagContractId, flagYes],
      },
    ],
  },
  {
    resource: 'subscription-drafts',
    description: 'Manage subscription drafts.',
    verbs: [
      getVerb({ operation: 'subscriptionDraft', description: 'Fetch a subscription draft by ID.' }),
      {
        verb: 'commit',
        description: 'Commit a subscription draft.',
        operation: { type: 'mutation', name: 'subscriptionDraftCommit' },
        requiredFlags: [flagId],
      },
      inputVerb({
        verb: 'update',
        description: 'Update a subscription draft.',
        operation: 'subscriptionDraftUpdate',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'add-line',
        description: 'Add a line item to a draft.',
        operation: 'subscriptionDraftLineAdd',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-line',
        description: 'Update a draft line item.',
        operation: 'subscriptionDraftLineUpdate',
        requiredFlags: [flagId, flagLineId],
      }),
      {
        verb: 'remove-line',
        description: 'Remove a line item from a draft.',
        operation: { type: 'mutation', name: 'subscriptionDraftLineRemove' },
        requiredFlags: [flagId, flagLineId],
      },
      inputVerb({
        verb: 'add-discount',
        description: 'Add a discount to a draft.',
        operation: 'subscriptionDraftDiscountAdd',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-discount',
        description: 'Update a draft discount.',
        operation: 'subscriptionDraftDiscountUpdate',
        requiredFlags: [flagId, flagDiscountId],
      }),
      {
        verb: 'remove-discount',
        description: 'Remove a discount from a draft.',
        operation: { type: 'mutation', name: 'subscriptionDraftDiscountRemove' },
        requiredFlags: [flagId, flagDiscountId],
      },
      {
        verb: 'apply-code',
        description: 'Apply a discount code to a draft.',
        operation: { type: 'mutation', name: 'subscriptionDraftDiscountCodeApply' },
        requiredFlags: [flagId, flagCode],
      },
      inputVerb({
        verb: 'add-free-shipping',
        description: 'Add free shipping to a draft.',
        operation: 'subscriptionDraftFreeShippingDiscountAdd',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-free-shipping',
        description: 'Update free shipping on a draft.',
        operation: 'subscriptionDraftFreeShippingDiscountUpdate',
        requiredFlags: [flagId, flagDiscountId],
      }),
    ],
  },
  {
    resource: 'metafield-definitions',
    description: 'Manage metafield definitions.',
    verbs: [
      createVerb({
        operation: 'metafieldDefinitionCreate',
        inputArg: 'definition',
        description: 'Create a metafield definition.',
      }),
      getVerb({ operation: 'metafieldDefinition', description: 'Fetch a metafield definition by ID.' }),
      {
        ...listVerb({
          operation: 'metafieldDefinitions',
          description: 'List metafield definitions.',
          notes: ['Use --owner-type to filter by owner type.'],
        }),
        flags: [flagOwnerType],
      },
      {
        verb: 'update',
        description: 'Update a metafield definition.',
        operation: { type: 'mutation', name: 'metafieldDefinitionUpdate', inputArg: 'definition' },
        input: { mode: 'set', arg: 'definition', required: true },
        flags: [flagId, flagKey, flagNamespace, flagOwnerType],
        notes: ['Pass either --id or all of --key, --namespace, and --owner-type.'],
      },
      deleteVerb({ operation: 'metafieldDefinitionDelete', description: 'Delete a metafield definition.' }),
    ],
  },
  {
    resource: 'metaobjects',
    description: 'Manage metaobjects.',
    verbs: [
      {
        verb: 'by-handle',
        description: 'Fetch a metaobject by type + handle.',
        operation: { type: 'query', name: 'metaobjectByHandle' },
        requiredFlags: [flagType, flagHandle],
        output: { view: true, selection: true },
      },
      {
        verb: 'definition-by-type',
        description: 'Fetch a metaobject definition by type.',
        operation: { type: 'query', name: 'metaobjectDefinitionByType' },
        requiredFlags: [flagType],
        output: { view: true, selection: true },
      },
      {
        verb: 'upsert',
        description: 'Upsert a metaobject by type + handle.',
        operation: { type: 'mutation', name: 'metaobjectUpsert' },
        requiredFlags: [flagType, flagHandle],
        flags: inputFlags,
        output: { view: true, selection: true },
      },
      {
        verb: 'bulk-delete',
        description: 'Bulk delete metaobjects.',
        operation: { type: 'mutation', name: 'metaobjectBulkDelete' },
        requiredFlags: [flagYes],
        flags: [flagType, flagIds],
      },
      createVerb({
        operation: 'metaobjectCreate',
        inputArg: 'metaobject',
        description: 'Create a metaobject.',
      }),
      getVerb({ operation: 'metaobject', description: 'Fetch a metaobject by ID.' }),
      {
        ...listVerb({ operation: 'metaobjects', description: 'List metaobjects.' }),
        requiredFlags: [flagType],
      },
      updateVerb({
        operation: 'metaobjectUpdate',
        inputArg: 'metaobject',
        description: 'Update a metaobject.',
      }),
      deleteVerb({ operation: 'metaobjectDelete', description: 'Delete a metaobject.' }),
    ],
  },
  {
    resource: 'metaobject-definitions',
    description: 'Manage metaobject definitions.',
    verbs: [
      createVerb({
        operation: 'metaobjectDefinitionCreate',
        inputArg: 'definition',
        description: 'Create a metaobject definition.',
      }),
      getVerb({ operation: 'metaobjectDefinition', description: 'Fetch a metaobject definition by ID.' }),
      listVerb({ operation: 'metaobjectDefinitions', description: 'List metaobject definitions.' }),
      updateVerb({
        operation: 'metaobjectDefinitionUpdate',
        inputArg: 'definition',
        description: 'Update a metaobject definition.',
      }),
      deleteVerb({ operation: 'metaobjectDefinitionDelete', description: 'Delete a metaobject definition.' }),
    ],
  },
  {
    resource: 'selling-plan-groups',
    description: 'Manage selling plan groups.',
    verbs: [
      createVerb({ operation: 'sellingPlanGroupCreate', description: 'Create a selling plan group.' }),
      getVerb({ operation: 'sellingPlanGroup', description: 'Fetch a selling plan group by ID.' }),
      listVerb({ operation: 'sellingPlanGroups', description: 'List selling plan groups.' }),
      updateVerb({ operation: 'sellingPlanGroupUpdate', description: 'Update a selling plan group.' }),
      deleteVerb({ operation: 'sellingPlanGroupDelete', description: 'Delete a selling plan group.' }),
      {
        verb: 'add-variants',
        description: 'Add variants to a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupAddProductVariants' },
        requiredFlags: [flagId, flagVariantIds],
      },
      {
        verb: 'remove-variants',
        description: 'Remove variants from a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupRemoveProductVariants' },
        requiredFlags: [flagId, flagVariantIds],
      },
    ],
  },
  {
    resource: 'selling-plan-group-products',
    description: 'Manage product and variant associations for selling plan groups.',
    verbs: [
      {
        verb: 'add-products',
        description: 'Add products to a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupAddProducts' },
        requiredFlags: [flagId, flagProductIds],
      },
      {
        verb: 'remove-products',
        description: 'Remove products from a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupRemoveProducts' },
        requiredFlags: [flagId, flagProductIds],
      },
      {
        verb: 'add-product-variants',
        description: 'Add product variants to a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupAddProductVariants' },
        requiredFlags: [flagId, flagVariantIds],
      },
      {
        verb: 'remove-product-variants',
        description: 'Remove product variants from a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupRemoveProductVariants' },
        requiredFlags: [flagId, flagVariantIds],
      },
    ],
  },
  {
    resource: 'companies',
    description: 'Manage companies.',
    verbs: [
      createVerb({ operation: 'companyCreate', description: 'Create a company.' }),
      getVerb({ operation: 'company', description: 'Fetch a company by ID.' }),
      listVerb({ operation: 'companies', description: 'List companies.' }),
      countVerb({ operation: 'companiesCount', description: 'Count companies.', flags: [flag('--limit <n>', 'Limit count precision')] }),
      updateVerb({ operation: 'companyUpdate', description: 'Update a company.' }),
      deleteVerb({ operation: 'companyDelete', description: 'Delete a company.' }),
      {
        verb: 'address-delete',
        description: 'Delete a company address.',
        operation: { type: 'mutation', name: 'companyAddressDelete' },
        requiredFlags: [flagAddressId, flagYes],
      },
      {
        verb: 'bulk-delete',
        description: 'Bulk delete companies.',
        operation: { type: 'mutation', name: 'companiesDelete' },
        requiredFlags: [flagIds, flagYes],
      },
      {
        verb: 'assign-main-contact',
        description: 'Assign a main contact to a company.',
        operation: { type: 'mutation', name: 'companyAssignMainContact' },
        requiredFlags: [flagId, flagContactId],
      },
      {
        verb: 'revoke-main-contact',
        description: 'Revoke a company main contact.',
        operation: { type: 'mutation', name: 'companyRevokeMainContact' },
        requiredFlags: [flagId],
      },
      {
        verb: 'assign-customer',
        description: 'Assign a customer as a company contact.',
        operation: { type: 'mutation', name: 'companyAssignCustomerAsContact' },
        requiredFlags: [flagId, flagCustomerId],
      },
    ],
  },
  {
    resource: 'company-contacts',
    description: 'Manage company contacts.',
    verbs: [
      getVerb({ operation: 'companyContact', description: 'Fetch a company contact by ID.' }),
      {
        verb: 'role-get',
        description: 'Fetch a company contact role by ID.',
        operation: { type: 'query', name: 'companyContactRole' },
        requiredFlags: [flagId],
      },
      inputVerb({
        verb: 'create',
        description: 'Create a company contact.',
        operation: 'companyContactCreate',
        requiredFlags: [flagCompanyId],
      }),
      updateVerb({
        operation: 'companyContactUpdate',
        description: 'Update a company contact.',
        inputArg: 'input',
      }),
      deleteVerb({ operation: 'companyContactDelete', description: 'Delete a company contact.' }),
      {
        verb: 'bulk-delete',
        description: 'Bulk delete company contacts.',
        operation: { type: 'mutation', name: 'companyContactsDelete' },
        requiredFlags: [flagIds, flagYes],
      },
      {
        verb: 'assign-role',
        description: 'Assign a role to a company contact.',
        operation: { type: 'mutation', name: 'companyContactAssignRole' },
        requiredFlags: [flagId, flagRoleId, flagLocationId],
      },
      {
        verb: 'assign-roles',
        description: 'Assign roles to a company contact.',
        operation: { type: 'mutation', name: 'companyContactAssignRoles' },
        requiredFlags: [flagId, flagRoleAssignments],
      },
      {
        verb: 'revoke-role',
        description: 'Revoke a role assignment.',
        operation: { type: 'mutation', name: 'companyContactRevokeRole' },
        requiredFlags: [flagId, flagRoleAssignmentId],
      },
      {
        verb: 'revoke-roles',
        description: 'Revoke role assignments.',
        operation: { type: 'mutation', name: 'companyContactRevokeRoles' },
        requiredFlags: [flagId],
        flags: [flagRoleAssignmentIds, flagAll],
        notes: ['Use --all to revoke all roles.'],
      },
      {
        verb: 'remove-from-company',
        description: 'Remove a contact from the company.',
        operation: { type: 'mutation', name: 'companyContactRemoveFromCompany' },
        requiredFlags: [flagId],
      },
      {
        verb: 'send-welcome-email',
        description: 'Send a welcome email to a contact.',
        operation: { type: 'mutation', name: 'companyContactSendWelcomeEmail' },
        requiredFlags: [flagId],
        flags: [flag('--email <json>', 'Email input JSON')],
      },
    ],
  },
  {
    resource: 'company-locations',
    description: 'Manage company locations.',
    verbs: [
      getVerb({ operation: 'companyLocation', description: 'Fetch a company location by ID.' }),
      listVerb({ operation: 'companyLocations', description: 'List company locations.' }),
      inputVerb({
        verb: 'create',
        description: 'Create a company location.',
        operation: 'companyLocationCreate',
        requiredFlags: [flagCompanyId],
      }),
      updateVerb({
        operation: 'companyLocationUpdate',
        description: 'Update a company location.',
        inputArg: 'input',
      }),
      deleteVerb({ operation: 'companyLocationDelete', description: 'Delete a company location.' }),
      {
        verb: 'bulk-delete',
        description: 'Bulk delete company locations.',
        operation: { type: 'mutation', name: 'companyLocationsDelete' },
        requiredFlags: [flagIds, flagYes],
      },
      {
        verb: 'assign-address',
        description: 'Assign addresses to a company location.',
        operation: { type: 'mutation', name: 'companyLocationAssignAddress' },
        requiredFlags: [flagId, flagAddressType, flagAddress],
      },
      {
        verb: 'assign-roles',
        description: 'Assign roles to a company location.',
        operation: { type: 'mutation', name: 'companyLocationAssignRoles' },
        requiredFlags: [flagId, flagRoleAssignments],
      },
      {
        verb: 'revoke-roles',
        description: 'Revoke roles from a company location.',
        operation: { type: 'mutation', name: 'companyLocationRevokeRoles' },
        requiredFlags: [flagId, flagRoleAssignmentIds],
      },
      {
        verb: 'assign-staff',
        description: 'Assign staff members to a company location.',
        operation: { type: 'mutation', name: 'companyLocationAssignStaffMembers' },
        requiredFlags: [flagId, flagStaffMemberIds],
      },
      {
        verb: 'remove-staff',
        description: 'Remove staff members from a company location.',
        operation: { type: 'mutation', name: 'companyLocationRemoveStaffMembers' },
        requiredFlags: [flagId],
        flags: [flagAssignmentIds, flagStaffMemberIds],
        notes: ['Pass either --assignment-ids or --staff-member-ids.'],
      },
      {
        verb: 'assign-tax-exemptions',
        description: 'Assign tax exemptions.',
        operation: { type: 'mutation', name: 'companyLocationAssignTaxExemptions' },
        requiredFlags: [flagId, flagExemptions],
      },
      {
        verb: 'revoke-tax-exemptions',
        description: 'Revoke tax exemptions.',
        operation: { type: 'mutation', name: 'companyLocationRevokeTaxExemptions' },
        requiredFlags: [flagId, flagExemptions],
      },
      {
        verb: 'create-tax-registration',
        description: 'Create a tax registration.',
        operation: { type: 'mutation', name: 'companyLocationCreateTaxRegistration' },
        requiredFlags: [flagId, flagTaxId],
      },
      {
        verb: 'revoke-tax-registration',
        description: 'Revoke a tax registration.',
        operation: { type: 'mutation', name: 'companyLocationRevokeTaxRegistration' },
        requiredFlags: [flagId],
      },
      {
        verb: 'update-tax-settings',
        description: 'Update tax settings for a location.',
        operation: { type: 'mutation', name: 'companyLocationTaxSettingsUpdate' },
        requiredFlags: [flagId],
        flags: [flagExemptions, flagRemoveExemptions, flagTaxExempt, flagTaxId],
      },
    ],
  },
  {
    resource: 'store-credit',
    description: 'Manage store credit accounts.',
    verbs: [
      {
        verb: 'get',
        description: 'Get store credit by account or owner.',
        operation: { type: 'query', name: 'storeCreditAccount' },
        flags: [flagId, flagOwnerId, flagFirst],
        output: { view: true, selection: true, pagination: true },
        notes: ['Provide --id or --owner-id.'],
      },
      inputVerb({
        verb: 'credit',
        description: 'Credit a store credit account.',
        operation: 'storeCreditAccountCredit',
        flags: [flagId, flagOwnerId, flagAmount, flagCurrency, flagExpiresAt, flagNotify],
        inputRequired: false,
        notes: ['Provide --id or --owner-id.', 'Provide --amount or --input/--set.'],
      }),
      inputVerb({
        verb: 'debit',
        description: 'Debit a store credit account.',
        operation: 'storeCreditAccountDebit',
        flags: [flagId, flagOwnerId, flagAmount, flagCurrency],
        inputRequired: false,
        notes: ['Provide --id or --owner-id.', 'Provide --amount or --input/--set.'],
      }),
    ],
  },
  {
    resource: 'delegate-tokens',
    description: 'Manage delegate access tokens.',
    verbs: [
      inputVerb({
        verb: 'create',
        description: 'Create a delegate access token.',
        operation: 'delegateAccessTokenCreate',
      }),
      {
        verb: 'destroy',
        description: 'Destroy a delegate access token.',
        operation: { type: 'mutation', name: 'delegateAccessTokenDestroy' },
        requiredFlags: [flagToken],
      },
    ],
  },
  {
    resource: 'themes',
    description: 'Manage themes.',
    verbs: [
      getVerb({ operation: 'theme', description: 'Fetch a theme by ID.' }),
      {
        ...listVerb({ operation: 'themes', description: 'List themes.' }),
        flags: [flagRoles],
      },
      {
        verb: 'create',
        description: 'Create a theme.',
        operation: { type: 'mutation', name: 'themeCreate' },
        flags: [flagName, flagRole, flagSource],
        input: { mode: 'set', required: false },
        notes: ['Requires --source or input.source/src.'],
      },
      updateVerb({ operation: 'themeUpdate', description: 'Update a theme.' }),
      deleteVerb({ operation: 'themeDelete', description: 'Delete a theme.' }),
      {
        verb: 'duplicate',
        description: 'Duplicate a theme.',
        operation: { type: 'mutation', name: 'themeDuplicate' },
        requiredFlags: [flagId],
        flags: [flagName],
      },
      {
        verb: 'publish',
        description: 'Publish a theme.',
        operation: { type: 'mutation', name: 'themePublish' },
        requiredFlags: [flagId],
      },
      {
        verb: 'files-upsert',
        description: 'Upsert theme files.',
        operation: { type: 'mutation', name: 'themeFilesUpsert' },
        requiredFlags: [flagId, flagFiles],
      },
      {
        verb: 'files-delete',
        description: 'Delete theme files.',
        operation: { type: 'mutation', name: 'themeFilesDelete' },
        requiredFlags: [flagId, flagFiles],
      },
      {
        verb: 'files-copy',
        description: 'Copy theme files.',
        operation: { type: 'mutation', name: 'themeFilesCopy' },
        requiredFlags: [flagId, flagFiles],
      },
    ],
  },
  {
    resource: 'cart-transforms',
    description: 'Manage cart transforms.',
    verbs: [
      {
        verb: 'create',
        description: 'Create a cart transform.',
        operation: { type: 'mutation', name: 'cartTransformCreate' },
        flags: [flagFunctionId, flagFunctionHandle, flagBlockOnFailure, flagMetafields],
        notes: ['Provide --function-id or --function-handle.'],
      },
      {
        verb: 'list',
        description: 'List cart transforms.',
        operation: { type: 'query', name: 'cartTransforms' },
        output: { pagination: true },
      },
      deleteVerb({ operation: 'cartTransformDelete', description: 'Delete a cart transform.' }),
    ],
  },
  {
    resource: 'validations',
    description: 'Manage checkout validations.',
    verbs: [
      inputVerb({
        verb: 'create',
        description: 'Create a validation.',
        operation: 'validationCreate',
        inputArg: 'validation',
        flags: [flagFunctionId],
      }),
      getVerb({ operation: 'validation', description: 'Fetch a validation by ID.' }),
      listVerb({ operation: 'validations', description: 'List validations.' }),
      updateVerb({ operation: 'validationUpdate', description: 'Update a validation.' }),
      deleteVerb({ operation: 'validationDelete', description: 'Delete a validation.' }),
    ],
  },
  {
    resource: 'checkout-branding',
    description: 'Manage checkout branding.',
    verbs: [
      {
        verb: 'get',
        description: 'Get checkout branding.',
        operation: { type: 'query', name: 'checkoutBranding' },
        requiredFlags: [flagProfileId],
      },
      inputVerb({
        verb: 'upsert',
        description: 'Upsert checkout branding.',
        operation: 'checkoutBrandingUpsert',
        inputArg: 'checkoutBrandingInput',
        requiredFlags: [flagProfileId],
      }),
    ],
  },
  {
    resource: 'checkout-profiles',
    description: 'Manage checkout profiles.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a checkout profile by ID.',
        operation: { type: 'query', name: 'checkoutProfile' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list',
        description: 'List checkout profiles.',
        operation: { type: 'query', name: 'checkoutProfiles' },
        flags: [flagFirst, flagAfter, flagQuery, flagSort, flagReverse],
        output: { view: true, selection: true, pagination: true },
      },
    ],
  },
  {
    resource: 'delivery-profiles',
    description: 'Manage delivery profiles.',
    verbs: [
      inputVerb({
        verb: 'create',
        description: 'Create a delivery profile.',
        operation: 'deliveryProfileCreate',
        inputArg: 'profile',
      }),
      getVerb({ operation: 'deliveryProfile', description: 'Fetch a delivery profile by ID.' }),
      listVerb({ operation: 'deliveryProfiles', description: 'List delivery profiles.' }),
      updateVerb({ operation: 'deliveryProfileUpdate', description: 'Update a delivery profile.' }),
      deleteVerb({ operation: 'deliveryProfileRemove', description: 'Delete a delivery profile.' }),
    ],
  },
  {
    resource: 'delivery-customizations',
    description: 'Manage delivery customizations.',
    verbs: [
      inputVerb({
        verb: 'create',
        description: 'Create a delivery customization.',
        operation: 'deliveryCustomizationCreate',
        inputArg: 'input',
        flags: [flagFunctionId],
      }),
      getVerb({ operation: 'deliveryCustomization', description: 'Fetch a delivery customization by ID.' }),
      listVerb({ operation: 'deliveryCustomizations', description: 'List delivery customizations.' }),
      updateVerb({ operation: 'deliveryCustomizationUpdate', description: 'Update a delivery customization.' }),
      deleteVerb({ operation: 'deliveryCustomizationDelete', description: 'Delete a delivery customization.' }),
      {
        verb: 'activate',
        description: 'Activate or deactivate a delivery customization.',
        operation: { type: 'mutation', name: 'deliveryCustomizationActivation' },
        requiredFlags: [flagId, flagEnabled],
      },
    ],
  },
  {
    resource: 'delivery-settings',
    description: 'Manage shop delivery settings.',
    verbs: [
      {
        verb: 'setting-update',
        description: 'Set the delivery settings for a shop.',
        operation: { type: 'mutation', name: 'deliverySettingUpdate' },
      },
      {
        verb: 'shipping-origin-assign',
        description: 'Assign a location as the shipping origin (legacy compatibility mode).',
        operation: { type: 'mutation', name: 'deliveryShippingOriginAssign' },
        requiredFlags: [flagLocationId],
      },
    ],
  },
  {
    resource: 'delivery-profile-locations',
    description: 'Query locations available for delivery profiles.',
    verbs: [
      {
        verb: 'available',
        description: 'List locations available for delivery profiles (deprecated list field).',
        operation: { type: 'query', name: 'locationsAvailableForDeliveryProfiles' },
      },
      {
        verb: 'available-connection',
        description: 'List locations available for delivery profiles (paginated).',
        operation: { type: 'query', name: 'locationsAvailableForDeliveryProfilesConnection' },
        flags: [flagFirst, flagAfter, flagReverse],
        output: { pagination: true },
      },
    ],
  },
  {
    resource: 'delivery-promises',
    description: 'Manage delivery promise settings, participants, and providers.',
    verbs: [
      {
        verb: 'get-settings',
        description: 'Get delivery promise settings for the shop.',
        operation: { type: 'query', name: 'deliveryPromiseSettings' },
      },
      {
        verb: 'get-participants',
        description: 'List delivery promise participants.',
        operation: { type: 'query', name: 'deliveryPromiseParticipants' },
        requiredFlags: [flagBrandedPromiseHandle],
        flags: [flagOwnerId],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'get-provider',
        description: 'Get delivery promise provider by location.',
        operation: { type: 'query', name: 'deliveryPromiseProvider' },
        requiredFlags: [flagLocationId],
        output: { view: true, selection: true },
      },
      {
        verb: 'provider',
        description: 'Get delivery promise provider by location.',
        operation: { type: 'query', name: 'deliveryPromiseProvider' },
        requiredFlags: [flagLocationId],
        output: { view: true, selection: true },
      },
      {
        verb: 'update-participants',
        description: 'Update delivery promise participants.',
        operation: { type: 'mutation', name: 'deliveryPromiseParticipantsUpdate' },
        requiredFlags: [flagBrandedPromiseHandle],
        flags: [flagOwnersToAdd, flagOwnersToRemove],
      },
      {
        verb: 'upsert-provider',
        description: 'Create or update a delivery promise provider.',
        operation: { type: 'mutation', name: 'deliveryPromiseProviderUpsert' },
        requiredFlags: [flagLocationId],
        flags: [flagActive, flagFulfillmentDelay, flagTimeZone],
      },
      {
        verb: 'provider-upsert',
        description: 'Create or update a delivery promise provider.',
        operation: { type: 'mutation', name: 'deliveryPromiseProviderUpsert' },
        requiredFlags: [flagLocationId],
        flags: [flagActive, flagFulfillmentDelay, flagTimeZone],
      },
    ],
  },
  {
    resource: 'shipping-packages',
    description: 'Manage shipping packages.',
    verbs: [
      inputVerb({
        verb: 'update',
        description: 'Update a shipping package.',
        operation: 'shippingPackageUpdate',
        inputArg: 'shippingPackage',
        requiredFlags: [flagId],
      }),
      {
        verb: 'make-default',
        description: 'Set a shipping package as the default.',
        operation: { type: 'mutation', name: 'shippingPackageMakeDefault' },
        requiredFlags: [flagId],
      },
      {
        verb: 'delete',
        description: 'Delete a shipping package.',
        operation: { type: 'mutation', name: 'shippingPackageDelete' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'web-pixels',
    description: 'Manage web pixels.',
    verbs: [
      inputVerb({
        verb: 'create',
        description: 'Create a web pixel.',
        operation: 'webPixelCreate',
      }),
      getVerb({ operation: 'webPixel', description: 'Fetch a web pixel by ID.' }),
      updateVerb({ operation: 'webPixelUpdate', description: 'Update a web pixel.' }),
      deleteVerb({ operation: 'webPixelDelete', description: 'Delete a web pixel.' }),
    ],
  },
  {
    resource: 'server-pixels',
    description: 'Manage server pixels.',
    verbs: [
      {
        verb: 'get',
        description: 'Get the current app server pixel.',
        operation: { type: 'query', name: 'serverPixel' },
        output: { view: true, selection: true },
      },
      {
        verb: 'create',
        description: 'Create a server pixel.',
        operation: { type: 'mutation', name: 'serverPixelCreate' },
      },
      {
        verb: 'delete',
        description: 'Delete the server pixel.',
        operation: { type: 'mutation', name: 'serverPixelDelete' },
        requiredFlags: [flagYes],
      },
      {
        verb: 'update-pubsub',
        description: 'Update Pub/Sub endpoint.',
        operation: { type: 'mutation', name: 'pubSubServerPixelUpdate' },
        requiredFlags: [flagPubSubProject, flagPubSubTopic],
      },
      {
        verb: 'pubsub-update',
        description: 'Update Pub/Sub endpoint (Plan 5 alias).',
        operation: { type: 'mutation', name: 'pubSubServerPixelUpdate' },
        requiredFlags: [flagPubSubProject, flagPubSubTopic],
      },
      {
        verb: 'update-eventbridge',
        description: 'Update EventBridge endpoint.',
        operation: { type: 'mutation', name: 'eventBridgeServerPixelUpdate' },
        requiredFlags: [flagArn],
      },
    ],
  },
  {
    resource: 'marketing-activities',
    description: 'Manage marketing activities.',
    verbs: [
      getVerb({ operation: 'marketingActivity', description: 'Fetch a marketing activity by ID.' }),
      listVerb({ operation: 'marketingActivities', description: 'List marketing activities.' }),
      inputVerb({
        verb: 'create',
        description: 'Create a marketing activity.',
        operation: 'marketingActivityCreate',
      }),
      inputVerb({
        verb: 'create-external',
        description: 'Create an external marketing activity.',
        operation: 'marketingActivityCreateExternal',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a marketing activity.',
        operation: 'marketingActivityUpdate',
        requiredFlags: [flagId],
        notes: ['ID can be provided via --id or input.id.'],
      }),
      inputVerb({
        verb: 'update-external',
        description: 'Update an external marketing activity.',
        operation: 'marketingActivityUpdateExternal',
        flags: [flagRemoteId, flagUtm],
        notes: ['Provide --id or --remote-id.'],
      }),
      inputVerb({
        verb: 'upsert-external',
        description: 'Upsert an external marketing activity.',
        operation: 'marketingActivityUpsertExternal',
      }),
      {
        verb: 'delete-external',
        description: 'Delete an external marketing activity.',
        operation: { type: 'mutation', name: 'marketingActivityDeleteExternal' },
        flags: [flagId, flagRemoteId],
        notes: ['Provide --id or --remote-id.'],
      },
      {
        verb: 'delete-all-external',
        description: 'Delete all external marketing activities.',
        operation: { type: 'mutation', name: 'marketingActivitiesDeleteAllExternal' },
        requiredFlags: [flagYes],
      },
      inputVerb({
        verb: 'create-engagement',
        description: 'Create a marketing engagement.',
        operation: 'marketingEngagementCreate',
        flags: [flagActivityId, flagChannelHandle, flagRemoteId],
      }),
      {
        verb: 'delete-engagements',
        description: 'Delete marketing engagements.',
        operation: { type: 'mutation', name: 'marketingEngagementsDelete' },
        requiredFlags: [],
        flags: [flagChannelHandle, flagAll],
      },
    ],
  },
  {
    resource: 'marketing-events',
    description: 'Query marketing events.',
    verbs: [
      getVerb({ operation: 'marketingEvent', description: 'Fetch a marketing event by ID.' }),
      listVerb({ operation: 'marketingEvents', description: 'List marketing events.' }),
    ],
  },
  {
    resource: 'bulk-operations',
    description: 'Manage bulk operations.',
    verbs: [
      {
        verb: 'run-query',
        description: 'Run a bulk query.',
        operation: { type: 'mutation', name: 'bulkOperationRunQuery' },
        requiredFlags: [flag('--query <graphql>', 'Bulk query document')],
        flags: [flagWait, flagWaitInterval],
      },
      {
        verb: 'run-mutation',
        description: 'Run a bulk mutation.',
        operation: { type: 'mutation', name: 'bulkOperationRunMutation' },
        requiredFlags: [flagMutation, flagStagedUploadPath],
        flags: [flagClientId, flagWait, flagWaitInterval],
      },
      {
        verb: 'get',
        description: 'Get a bulk operation by ID.',
        operation: { type: 'query', name: 'bulkOperation' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list',
        description: 'List bulk operations.',
        operation: { type: 'query', name: 'bulkOperations' },
        flags: [flag('--type <QUERY|MUTATION>', 'Operation type'), flagStatusValue],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'current',
        description: 'Get the current bulk operation.',
        operation: { type: 'query', name: 'currentBulkOperation' },
        flags: [flag('--type <QUERY|MUTATION>', 'Operation type')],
        output: { view: true, selection: true },
      },
      {
        verb: 'job',
        description: 'Get a job by ID.',
        operation: { type: 'query', name: 'job' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'cancel',
        description: 'Cancel a bulk operation.',
        operation: { type: 'mutation', name: 'bulkOperationCancel' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'discounts-automatic',
    description: 'Manage automatic discounts.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch an automatic discount by ID.',
        operation: { type: 'query', name: 'automaticDiscountNode' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list',
        description: 'List automatic discounts.',
        operation: { type: 'query', name: 'automaticDiscountNodes' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'get-discount',
        description: 'Fetch a DiscountAutomatic by ID (deprecated API).',
        operation: { type: 'query', name: 'automaticDiscount' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list-discounts',
        description: 'List DiscountAutomatic resources (deprecated API).',
        operation: { type: 'query', name: 'automaticDiscounts' },
        flags: [flagFirst, flagAfter, flagQuery, flagSavedSearchId, flagSort, flagReverse],
        output: { view: true, selection: true, pagination: true },
      },
      inputVerb({
        verb: 'create-basic',
        description: 'Create an automatic basic discount.',
        operation: 'discountAutomaticBasicCreate',
        inputArg: 'automaticBasicDiscount',
      }),
      inputVerb({
        verb: 'create-bxgy',
        description: 'Create an automatic BXGY discount.',
        operation: 'discountAutomaticBxgyCreate',
        inputArg: 'automaticBxgyDiscount',
      }),
      inputVerb({
        verb: 'create-free-shipping',
        description: 'Create an automatic free shipping discount.',
        operation: 'discountAutomaticFreeShippingCreate',
        inputArg: 'freeShippingAutomaticDiscount',
      }),
      inputVerb({
        verb: 'create-app',
        description: 'Create an automatic app discount.',
        operation: 'discountAutomaticAppCreate',
        inputArg: 'automaticAppDiscount',
        flags: [flagFunctionId],
      }),
      inputVerb({
        verb: 'update-basic',
        description: 'Update an automatic basic discount.',
        operation: 'discountAutomaticBasicUpdate',
        inputArg: 'automaticBasicDiscount',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-bxgy',
        description: 'Update an automatic BXGY discount.',
        operation: 'discountAutomaticBxgyUpdate',
        inputArg: 'automaticBxgyDiscount',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-free-shipping',
        description: 'Update an automatic free shipping discount.',
        operation: 'discountAutomaticFreeShippingUpdate',
        inputArg: 'freeShippingAutomaticDiscount',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-app',
        description: 'Update an automatic app discount.',
        operation: 'discountAutomaticAppUpdate',
        inputArg: 'automaticAppDiscount',
        requiredFlags: [flagId],
        flags: [flagFunctionId],
      }),
      {
        verb: 'delete',
        description: 'Delete an automatic discount.',
        operation: { type: 'mutation', name: 'discountAutomaticDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'bulk-delete',
        description: 'Bulk delete automatic discounts by IDs or query.',
        operation: { type: 'mutation', name: 'discountAutomaticBulkDelete' },
        requiredFlags: [flagYes],
        flags: [flagIds, flagQuery],
        notes: ['Provide --ids or --query.'],
      },
      {
        verb: 'activate',
        description: 'Activate an automatic discount.',
        operation: { type: 'mutation', name: 'discountAutomaticActivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'deactivate',
        description: 'Deactivate an automatic discount.',
        operation: { type: 'mutation', name: 'discountAutomaticDeactivate' },
        requiredFlags: [flagId],
      },
    ],
  },
  {
    resource: 'discounts-code',
    description: 'Manage code discounts.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a code discount by ID.',
        operation: { type: 'query', name: 'codeDiscountNode' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'get-by-code',
        description: 'Fetch a code discount by the redeemable code string.',
        operation: { type: 'query', name: 'codeDiscountNodeByCode' },
        requiredFlags: [flagCode],
        output: { view: true, selection: true },
      },
      {
        verb: 'list',
        description: 'List code discounts.',
        operation: { type: 'query', name: 'codeDiscountNodes' },
        output: { view: true, selection: true, pagination: true },
      },
      countVerb({
        operation: 'discountCodesCount',
        description: 'Count code discounts.',
        flags: [flagQuery],
      }),
      inputVerb({
        verb: 'create-basic',
        description: 'Create a basic code discount.',
        operation: 'discountCodeBasicCreate',
        inputArg: 'basicCodeDiscount',
      }),
      inputVerb({
        verb: 'create-bxgy',
        description: 'Create a BXGY code discount.',
        operation: 'discountCodeBxgyCreate',
        inputArg: 'bxgyCodeDiscount',
      }),
      inputVerb({
        verb: 'create-free-shipping',
        description: 'Create a free shipping code discount.',
        operation: 'discountCodeFreeShippingCreate',
        inputArg: 'freeShippingCodeDiscount',
      }),
      inputVerb({
        verb: 'create-app',
        description: 'Create an app-managed code discount.',
        operation: 'discountCodeAppCreate',
        inputArg: 'codeAppDiscount',
        flags: [flagFunctionId],
      }),
      inputVerb({
        verb: 'update-basic',
        description: 'Update a basic code discount.',
        operation: 'discountCodeBasicUpdate',
        inputArg: 'basicCodeDiscount',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-bxgy',
        description: 'Update a BXGY code discount.',
        operation: 'discountCodeBxgyUpdate',
        inputArg: 'bxgyCodeDiscount',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-free-shipping',
        description: 'Update a free shipping code discount.',
        operation: 'discountCodeFreeShippingUpdate',
        inputArg: 'freeShippingCodeDiscount',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-app',
        description: 'Update an app-managed code discount.',
        operation: 'discountCodeAppUpdate',
        inputArg: 'codeAppDiscount',
        requiredFlags: [flagId],
        flags: [flagFunctionId],
      }),
      {
        verb: 'delete',
        description: 'Delete a code discount.',
        operation: { type: 'mutation', name: 'discountCodeDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'bulk-delete',
        description: 'Bulk delete code discounts by IDs or query.',
        operation: { type: 'mutation', name: 'discountCodeBulkDelete' },
        requiredFlags: [flagYes],
        flags: [flagIds, flagQuery],
        notes: ['Provide --ids or --query.'],
      },
      {
        verb: 'activate',
        description: 'Activate a code discount.',
        operation: { type: 'mutation', name: 'discountCodeActivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'deactivate',
        description: 'Deactivate a code discount.',
        operation: { type: 'mutation', name: 'discountCodeDeactivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'bulk-activate',
        description: 'Bulk activate code discounts by IDs or query.',
        operation: { type: 'mutation', name: 'discountCodeBulkActivate' },
        flags: [flagIds, flagQuery],
        notes: ['Provide --ids or --query.'],
      },
      {
        verb: 'bulk-deactivate',
        description: 'Bulk deactivate code discounts by IDs or query.',
        operation: { type: 'mutation', name: 'discountCodeBulkDeactivate' },
        flags: [flagIds, flagQuery],
        notes: ['Provide --ids or --query.'],
      },
      {
        verb: 'add-redeem-codes',
        description: 'Bulk add redeem codes to a discount.',
        operation: { type: 'mutation', name: 'discountRedeemCodeBulkAdd' },
        requiredFlags: [flagId],
        flags: [flagRedeemCodes, flagInput],
        notes: ['Provide --codes or input codes array.'],
      },
      {
        verb: 'delete-redeem-codes',
        description: 'Bulk delete redeem codes from a discount by IDs or query.',
        operation: { type: 'mutation', name: 'discountCodeRedeemCodeBulkDelete' },
        requiredFlags: [flagId, flagYes],
        flags: [flagIds, flagQuery],
        notes: ['Provide --ids or --query.'],
      },
    ],
  },
  {
    resource: 'discount-nodes',
    description: 'Query discount nodes (unified discount surface).',
    verbs: [
      getVerb({ operation: 'discountNode', description: 'Fetch a discount node by ID.' }),
      {
        ...listVerb({ operation: 'discountNodes', description: 'List discount nodes.' }),
        flags: [flagSavedSearchId],
      },
      countVerb({
        operation: 'discountNodesCount',
        description: 'Count discount nodes.',
        flags: [flagQuery, flagLimit],
      }),
    ],
  },
  {
    resource: 'discount-saved-searches',
    description: 'List discount-related saved searches.',
    verbs: [
      {
        verb: 'automatic',
        description: 'List automatic discount saved searches.',
        operation: { type: 'query', name: 'automaticDiscountSavedSearches' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'code',
        description: 'List code discount saved searches.',
        operation: { type: 'query', name: 'codeDiscountSavedSearches' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'redeem-code',
        description: 'List discount redeem code saved searches.',
        operation: { type: 'query', name: 'discountRedeemCodeSavedSearches' },
        output: { view: true, selection: true, pagination: true },
      },
    ],
  },
  {
    resource: 'discount-redeem-codes',
    description: 'Query and manage discount redeem code bulk operations.',
    verbs: [
      {
        verb: 'get-bulk-creation',
        description: 'Fetch a DiscountRedeemCodeBulkCreation by ID.',
        operation: { type: 'query', name: 'discountRedeemCodeBulkCreation' },
        requiredFlags: [flagId],
      },
      {
        verb: 'bulk-delete',
        description: 'Bulk delete redeem codes by IDs or query.',
        operation: { type: 'mutation', name: 'discountCodeRedeemCodeBulkDelete' },
        requiredFlags: [flagDiscountId, flagYes],
        flags: [flagIds, flagQuery],
        notes: ['Provide --ids or --query.'],
      },
    ],
  },
  {
    resource: 'fulfillment-services',
    description: 'Manage fulfillment services.',
    verbs: [
      getVerb({ operation: 'fulfillmentService', description: 'Fetch a fulfillment service by ID.' }),
      {
        verb: 'list',
        description: 'List fulfillment services.',
        operation: { type: 'query', name: 'shop' },
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'create',
        description: 'Create a fulfillment service.',
        operation: 'fulfillmentServiceCreate',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a fulfillment service.',
        operation: 'fulfillmentServiceUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'delete',
        description: 'Delete a fulfillment service.',
        operation: { type: 'mutation', name: 'fulfillmentServiceDelete' },
        requiredFlags: [flagId, flagYes],
        flags: [flag('--destination-location-id <gid>', 'Destination location ID'), flag('--inventory-action <TRANSFER|KEEP|DELETE>', 'Inventory action')],
      },
    ],
  },
  {
    resource: 'gift-cards',
    description: 'Manage gift cards.',
    verbs: [
      getVerb({ operation: 'giftCard', description: 'Fetch a gift card by ID.' }),
      listVerb({ operation: 'giftCards', description: 'List gift cards.' }),
      countVerb({ operation: 'giftCardsCount', description: 'Count gift cards.', flags: [flagQuery] }),
      {
        verb: 'config',
        description: 'Get gift card configuration.',
        operation: { type: 'query', name: 'giftCardConfiguration' },
      },
      inputVerb({
        verb: 'create',
        description: 'Create a gift card.',
        operation: 'giftCardCreate',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a gift card.',
        operation: 'giftCardUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'credit',
        description: 'Credit a gift card.',
        operation: { type: 'mutation', name: 'giftCardCredit' },
        requiredFlags: [flagId],
        flags: [flag('--credit-amount <money>', 'Credit amount (JSON MoneyInput)'), flagInput],
      },
      {
        verb: 'debit',
        description: 'Debit a gift card.',
        operation: { type: 'mutation', name: 'giftCardDebit' },
        requiredFlags: [flagId],
        flags: [flag('--debit-amount <money>', 'Debit amount (JSON MoneyInput)'), flagInput],
      },
      {
        verb: 'deactivate',
        description: 'Deactivate a gift card.',
        operation: { type: 'mutation', name: 'giftCardDeactivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'notify-customer',
        description: 'Send a gift card notification to the customer.',
        operation: { type: 'mutation', name: 'giftCardSendNotificationToCustomer' },
        requiredFlags: [flagId],
      },
      {
        verb: 'notify-recipient',
        description: 'Send a gift card notification to the recipient.',
        operation: { type: 'mutation', name: 'giftCardSendNotificationToRecipient' },
        requiredFlags: [flagId],
      },
    ],
  },
  {
    resource: 'inventory-transfers',
    description: 'Manage inventory transfers.',
    verbs: [
      getVerb({ operation: 'inventoryTransfer', description: 'Fetch an inventory transfer by ID.' }),
      listVerb({ operation: 'inventoryTransfers', description: 'List inventory transfers.' }),
      inputVerb({
        verb: 'create',
        description: 'Create an inventory transfer.',
        operation: 'inventoryTransferCreate',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'create-ready',
        description: 'Create an inventory transfer as ready to ship.',
        operation: 'inventoryTransferCreateAsReadyToShip',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'edit',
        description: 'Edit an inventory transfer.',
        operation: 'inventoryTransferEdit',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'duplicate',
        description: 'Duplicate an inventory transfer.',
        operation: { type: 'mutation', name: 'inventoryTransferDuplicate' },
        requiredFlags: [flagId],
        flags: [flagNewTitle],
      },
      {
        verb: 'mark-ready',
        description: 'Mark an inventory transfer as ready to ship.',
        operation: { type: 'mutation', name: 'inventoryTransferMarkAsReadyToShip' },
        requiredFlags: [flagId],
      },
      {
        verb: 'cancel',
        description: 'Cancel an inventory transfer.',
        operation: { type: 'mutation', name: 'inventoryTransferCancel' },
        requiredFlags: [flagId],
      },
      {
        verb: 'set-items',
        description: 'Set inventory transfer line items.',
        operation: { type: 'mutation', name: 'inventoryTransferSetItems' },
        requiredFlags: [flagId, flagItems],
      },
      {
        verb: 'remove-items',
        description: 'Remove inventory transfer line items.',
        operation: { type: 'mutation', name: 'inventoryTransferRemoveItems' },
        requiredFlags: [flagId, flagItems],
      },
      {
        verb: 'delete',
        description: 'Delete an inventory transfer.',
        operation: { type: 'mutation', name: 'inventoryTransferDelete' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'locations',
    description: 'Manage locations.',
    verbs: [
      {
        verb: 'by-identifier',
        description: 'Fetch a location by identifier.',
        operation: { type: 'query', name: 'locationByIdentifier' },
        flags: [flagId, flagCustomIdNamespace, flagCustomIdKey, flagCustomIdValue],
        notes: ['Provide either --id or --custom-id-key/--custom-id-value (optionally with --custom-id-namespace).'],
        output: { view: true, selection: true },
      },
      getVerb({ operation: 'location', description: 'Fetch a location by ID.' }),
      listVerb({ operation: 'locations', description: 'List locations.' }),
      countVerb({ operation: 'locationsCount', description: 'Count locations.', flags: [flagQuery] }),
      inputVerb({
        verb: 'create',
        description: 'Create a location.',
        operation: 'locationAdd',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a location.',
        operation: 'locationEdit',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'delete',
        description: 'Delete a location.',
        operation: { type: 'mutation', name: 'locationDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'activate',
        description: 'Activate a location.',
        operation: { type: 'mutation', name: 'locationActivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'deactivate',
        description: 'Deactivate a location.',
        operation: { type: 'mutation', name: 'locationDeactivate' },
        requiredFlags: [flagId],
      },
      {
        verb: 'enable-local-pickup',
        description: 'Enable local pickup at a location.',
        operation: { type: 'mutation', name: 'locationLocalPickupEnable' },
        requiredFlags: [flagId],
      },
      {
        verb: 'disable-local-pickup',
        description: 'Disable local pickup at a location.',
        operation: { type: 'mutation', name: 'locationLocalPickupDisable' },
        requiredFlags: [flagId],
      },
    ],
  },
  {
    resource: 'payment-terms',
    description: 'Manage payment terms.',
    verbs: [
      {
        verb: 'templates',
        description: 'List payment terms templates.',
        operation: { type: 'query', name: 'paymentTermsTemplates' },
        flags: [flagType],
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'create',
        description: 'Create payment terms for an order.',
        operation: 'paymentTermsCreate',
        requiredFlags: [flag('--reference-id <gid>', 'Order ID')],
        inputArg: 'paymentTermsAttributes',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update payment terms.',
        operation: 'paymentTermsUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'delete',
        description: 'Delete payment terms.',
        operation: { type: 'mutation', name: 'paymentTermsDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'send-reminder',
        description: 'Send a payment reminder.',
        operation: { type: 'mutation', name: 'paymentReminderSend' },
        requiredFlags: [flag('--payment-schedule-id <gid>', 'Payment schedule ID')],
      },
    ],
  },
  {
    resource: 'price-lists',
    description: 'Manage price lists.',
    verbs: [
      getVerb({ operation: 'priceList', description: 'Fetch a price list by ID.' }),
      listVerb({ operation: 'priceLists', description: 'List price lists.' }),
      inputVerb({
        verb: 'create',
        description: 'Create a price list.',
        operation: 'priceListCreate',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a price list.',
        operation: 'priceListUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      {
        verb: 'delete',
        description: 'Delete a price list.',
        operation: { type: 'mutation', name: 'priceListDelete' },
        requiredFlags: [flagId, flagYes],
      },
      inputVerb({
        verb: 'add-prices',
        description: 'Add fixed prices to a price list.',
        operation: 'priceListFixedPricesAdd',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-prices',
        description: 'Update fixed prices in a price list.',
        operation: 'priceListFixedPricesUpdate',
        requiredFlags: [flagId],
      }),
      inputVerb({
        verb: 'update-prices-by-product',
        description: 'Update fixed prices by product.',
        operation: 'priceListFixedPricesByProductUpdate',
        requiredFlags: [flagId],
        flags: [flagProductId],
      }),
      {
        verb: 'delete-prices',
        description: 'Delete fixed prices from a price list.',
        operation: { type: 'mutation', name: 'priceListFixedPricesDelete' },
        requiredFlags: [flagId, flagYes, flagVariantIds],
      },
      inputVerb({
        verb: 'add-quantity-rules',
        description: 'Add quantity rules to a price list.',
        operation: 'quantityRulesAdd',
        requiredFlags: [flagId],
      }),
      {
        verb: 'delete-quantity-rules',
        description: 'Delete quantity rules from a price list.',
        operation: { type: 'mutation', name: 'quantityRulesDelete' },
        requiredFlags: [flagId, flagYes, flagVariantIds],
      },
      inputVerb({
        verb: 'update-quantity-pricing',
        description: 'Update quantity pricing for a price list.',
        operation: 'quantityPricingByVariantUpdate',
        requiredFlags: [flagId],
      }),
    ],
  },
  {
    resource: 'refunds',
    description: 'Manage refunds.',
    verbs: [
      getVerb({ operation: 'refund', description: 'Fetch a refund by ID.' }),
      {
        verb: 'calculate',
        description: 'Calculate a suggested refund for an order.',
        operation: { type: 'query', name: 'order' },
        requiredFlags: [flagOrderId],
        input: { mode: 'set', required: true },
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'create',
        description: 'Create a refund.',
        operation: 'refundCreate',
        requiredFlags: [flagOrderId],
        inputArg: 'input',
        flags: [flagNotify, flag('--restock', 'Set restockType=RETURN where missing')],
      }),
    ],
  },
  {
    resource: 'abandoned-checkouts',
    description: 'Manage abandoned checkouts and abandonment events.',
    verbs: [
      {
        verb: 'list',
        description: 'List abandoned checkouts.',
        operation: { type: 'query', name: 'abandonedCheckouts' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'count',
        description: 'Count abandoned checkouts.',
        operation: { type: 'query', name: 'abandonedCheckoutsCount' },
        flags: [flagQuery, flagLimit],
      },
      {
        verb: 'abandonment',
        description: 'Fetch an abandonment by ID.',
        operation: { type: 'query', name: 'abandonment' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'abandonment-by-checkout',
        description: 'Fetch the abandonment event for an abandoned checkout.',
        operation: { type: 'query', name: 'abandonmentByAbandonedCheckoutId' },
        requiredFlags: [flag('--checkout-id <gid>', 'Abandoned checkout ID')],
        output: { view: true, selection: true },
      },
      {
        verb: 'update-email-state',
        description: 'Update abandonment email state (deprecated API).',
        operation: { type: 'mutation', name: 'abandonmentEmailStateUpdate' },
        requiredFlags: [flagId, flag('--state <value>', 'AbandonmentEmailState')],
        flags: [flag('--email-sent-at <iso>', 'Email sent timestamp'), flagReason],
      },
      {
        verb: 'update-activity-delivery-status',
        description: 'Update marketing activity delivery status for an abandonment.',
        operation: { type: 'mutation', name: 'abandonmentUpdateActivitiesDeliveryStatuses' },
        requiredFlags: [
          flag('--abandonment-id <gid>', 'Abandonment ID'),
          flag('--marketing-activity-id <gid>', 'Marketing activity ID'),
          flagStatus,
        ],
        flags: [flag('--delivered-at <iso>', 'Delivered timestamp'), flagReason],
      },
    ],
  },
  {
    resource: 'payment-customizations',
    description: 'Manage payment customizations (Shopify Functions).',
    verbs: [
      getVerb({ operation: 'paymentCustomization', description: 'Fetch a payment customization by ID.' }),
      listVerb({ operation: 'paymentCustomizations', description: 'List payment customizations.' }),
      inputVerb({
        verb: 'create',
        description: 'Create a payment customization.',
        operation: 'paymentCustomizationCreate',
        inputArg: 'paymentCustomization',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a payment customization.',
        operation: 'paymentCustomizationUpdate',
        requiredFlags: [flagId],
        inputArg: 'paymentCustomization',
      }),
      {
        verb: 'delete',
        description: 'Delete a payment customization.',
        operation: { type: 'mutation', name: 'paymentCustomizationDelete' },
        requiredFlags: [flagId, flagYes],
      },
      {
        verb: 'set-enabled',
        description: 'Activate/deactivate payment customizations.',
        operation: { type: 'mutation', name: 'paymentCustomizationActivation' },
        requiredFlags: [flag('--enabled <bool>', 'Enable/disable'), flagIds],
      },
    ],
  },
  {
    resource: 'taxonomy',
    description: 'Query Shopify’s standardized product taxonomy.',
    verbs: [
      {
        verb: 'categories',
        description: 'List taxonomy categories (supports search and hierarchy filters).',
        operation: { type: 'query', name: 'taxonomy' },
        flags: [
          flag('--search <string>', 'Search query'),
          flag('--children-of <id>', 'Return children of this taxonomy category ID'),
          flag('--descendants-of <id>', 'Return descendants of this taxonomy category ID'),
          flag('--siblings-of <id>', 'Return siblings of this taxonomy category ID'),
        ],
        output: { pagination: true },
      },
      {
        verb: 'list',
        description: 'Alias for taxonomy categories.',
        operation: { type: 'query', name: 'taxonomy' },
        output: { pagination: true },
      },
    ],
  },
  {
    resource: 'staff',
    description: 'Query staff members.',
    verbs: [
      {
        verb: 'me',
        description: 'Fetch the current staff member.',
        operation: { type: 'query', name: 'currentStaffMember' },
        output: { view: true, selection: true },
      },
      getVerb({ operation: 'staffMember', description: 'Fetch a staff member by ID.' }),
      listVerb({ operation: 'staffMembers', description: 'List staff members.' }),
    ],
  },
  {
    resource: 'storefront-access-tokens',
    description: 'Manage Storefront API access tokens.',
    verbs: [
      {
        verb: 'list',
        description: 'List storefront access tokens.',
        operation: { type: 'query', name: 'shop' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'get',
        description: 'Fetch a storefront access token by ID (by listing and filtering locally).',
        operation: { type: 'query', name: 'shop' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'create',
        description: 'Create a storefront access token.',
        operation: 'storefrontAccessTokenCreate',
        inputArg: 'input',
        flags: [flag('--title <string>', 'Token title')],
      }),
      {
        verb: 'create-basic',
        description: 'Create a storefront access token (basic flags).',
        operation: { type: 'mutation', name: 'storefrontAccessTokenCreate' },
        requiredFlags: [flagTitle],
      },
      {
        verb: 'delete',
        description: 'Delete a storefront access token.',
        operation: { type: 'mutation', name: 'storefrontAccessTokenDelete' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'fulfillment-constraint-rules',
    description: 'Manage fulfillment constraint rules (Shopify Functions).',
    verbs: [
      {
        verb: 'list',
        description: 'List fulfillment constraint rules.',
        operation: { type: 'query', name: 'fulfillmentConstraintRules' },
      },
      {
        verb: 'create',
        description: 'Create a fulfillment constraint rule.',
        operation: { type: 'mutation', name: 'fulfillmentConstraintRuleCreate' },
        requiredFlags: [flag('--delivery-method-types <csv>', 'Delivery method types (csv)'), flag('--function-handle <handle>', 'Function handle')],
        flags: [flagFunctionId, flagMetafields],
      },
      {
        verb: 'update',
        description: 'Update a fulfillment constraint rule.',
        operation: { type: 'mutation', name: 'fulfillmentConstraintRuleUpdate' },
        requiredFlags: [flagId, flag('--delivery-method-types <csv>', 'Delivery method types (csv)')],
      },
      {
        verb: 'delete',
        description: 'Delete a fulfillment constraint rule.',
        operation: { type: 'mutation', name: 'fulfillmentConstraintRuleDelete' },
        requiredFlags: [flagId, flagYes],
      },
    ],
  },
  {
    resource: 'shopify-payments',
    description: 'Query Shopify Payments account information.',
    verbs: [
      {
        verb: 'account',
        description: 'Fetch Shopify Payments account.',
        operation: { type: 'query', name: 'shopifyPaymentsAccount' },
        output: { view: true, selection: true },
      },
      {
        verb: 'get',
        description: 'Alias for shopify-payments account.',
        operation: { type: 'query', name: 'shopifyPaymentsAccount' },
        output: { view: true, selection: true },
      },
      {
        verb: 'payout-alternate-currency-create',
        description: 'Create an alternate currency payout for Shopify Payments.',
        operation: { type: 'mutation', name: 'shopifyPaymentsPayoutAlternateCurrencyCreate' },
        requiredFlags: [flagCurrency],
        flags: [flagAccountId],
      },
    ],
  },
  {
    resource: 'finance',
    description: 'Finance app utilities.',
    verbs: [
      {
        verb: 'app-access-policy',
        description: 'Fetch finance app access policy.',
        operation: { type: 'query', name: 'financeAppAccessPolicy' },
      },
      {
        verb: 'kyc-information',
        description: 'Fetch finance KYC information.',
        operation: { type: 'query', name: 'financeKycInformation' },
      },
    ],
  },
  {
    resource: 'tender-transactions',
    description: 'Query tender transactions.',
    verbs: [
      {
        verb: 'list',
        description: 'List tender transactions.',
        operation: { type: 'query', name: 'tenderTransactions' },
        output: { view: true, selection: true, pagination: true },
      },
    ],
  },
  {
    resource: 'disputes',
    description: 'Query disputes and manage dispute evidence.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch a dispute by ID.',
        operation: { type: 'query', name: 'dispute' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list',
        description: 'List disputes.',
        operation: { type: 'query', name: 'disputes' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'evidence get',
        description: 'Fetch dispute evidence by ID.',
        operation: { type: 'query', name: 'disputeEvidence' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'evidence update',
        description: 'Update dispute evidence.',
        operation: { type: 'mutation', name: 'disputeEvidenceUpdate', inputArg: 'input' },
        input: { mode: 'set', arg: 'input', required: true },
        requiredFlags: [flagId],
      },
    ],
  },
  {
    resource: 'business-entities',
    description: 'Query business entities (multiple legal entities).',
    verbs: [
      {
        verb: 'list',
        description: 'List business entities.',
        operation: { type: 'query', name: 'businessEntities' },
        output: { view: true, selection: true },
      },
      {
        verb: 'get',
        description: 'Fetch a business entity by ID (or primary entity when omitted).',
        operation: { type: 'query', name: 'businessEntity' },
        flags: [flagId],
        output: { view: true, selection: true },
      },
    ],
  },
  {
    resource: 'shop-policies',
    description: 'Manage shop legal policies.',
    verbs: [
      {
        verb: 'list',
        description: 'List shop policies.',
        operation: { type: 'query', name: 'shop' },
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'update',
        description: 'Update a shop policy.',
        operation: 'shopPolicyUpdate',
        inputArg: 'shopPolicy',
      }),
    ],
  },
  {
    resource: 'cash-tracking',
    description: 'Query POS cash tracking sessions.',
    verbs: [
      getVerb({ operation: 'cashTrackingSession', description: 'Fetch a cash tracking session by ID.' }),
      listVerb({ operation: 'cashTrackingSessions', description: 'List cash tracking sessions.' }),
    ],
  },
  {
    resource: 'point-of-sale',
    description: 'Query point of sale devices.',
    verbs: [
      getVerb({ operation: 'pointOfSaleDevice', description: 'Fetch a POS device by ID.' }),
    ],
  },
  {
    resource: 'customer-account-pages',
    description: 'Query customer account pages.',
    verbs: [
      getVerb({ operation: 'customerAccountPage', description: 'Fetch a customer account page by ID.' }),
      listVerb({ operation: 'customerAccountPages', description: 'List customer account pages.' }),
    ],
  },
  {
    resource: 'mobile-platform-applications',
    description: 'Manage mobile platform applications.',
    verbs: [
      {
        verb: 'list',
        description: 'List mobile platform applications.',
        operation: { type: 'query', name: 'mobilePlatformApplications' },
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'get',
        description: 'Fetch a mobile platform application by ID.',
        operation: { type: 'query', name: 'mobilePlatformApplication' },
        requiredFlags: [flagId],
        flags: [flagPlatform],
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'create',
        description: 'Create a mobile platform application.',
        operation: 'mobilePlatformApplicationCreate',
      }),
      {
        verb: 'update',
        description: 'Update a mobile platform application.',
        operation: { type: 'mutation', name: 'mobilePlatformApplicationUpdate', inputArg: 'input' },
        input: { mode: 'set', arg: 'input', required: true },
        requiredFlags: [flagId],
        flags: [flagPlatform],
      },
      {
        verb: 'delete',
        description: 'Delete a mobile platform application.',
        operation: { type: 'mutation', name: 'mobilePlatformApplicationDelete' },
        requiredFlags: [flagId, flagYes],
        flags: [flagPlatform],
      },
    ],
  },
  {
    resource: 'app-billing',
    description: 'Manage app billing.',
    verbs: [
      {
        verb: 'purchase-one-time-create',
        description: 'Create a one-time purchase (Plan 5).',
        operation: { type: 'mutation', name: 'appPurchaseOneTimeCreate' },
        requiredFlags: [flagName, flagAmount, flagCurrency, flagReturnUrl],
        flags: [flag('--test', 'Test mode')],
      },
      {
        verb: 'subscription-create',
        description: 'Create an app subscription (Plan 5).',
        operation: { type: 'mutation', name: 'appSubscriptionCreate' },
        requiredFlags: [flagName, flagReturnUrl],
        flags: [flagLineItems, flagTrialDays, flagReplacementBehavior, flag('--test', 'Test mode')],
      },
      {
        verb: 'subscription-trial-extend',
        description: 'Extend an app subscription trial (Plan 5).',
        operation: { type: 'mutation', name: 'appSubscriptionTrialExtend' },
        requiredFlags: [flagId, flagDays],
      },
      {
        verb: 'usage-record-create',
        description: 'Create a usage record (Plan 5).',
        operation: { type: 'mutation', name: 'appUsageRecordCreate' },
        requiredFlags: [flagSubscriptionLineItemId, flagDescription, flagAmount, flagCurrency],
        flags: [flagIdempotencyKey],
      },
      {
        verb: 'uninstall',
        description: 'Uninstall the app (Plan 5).',
        operation: { type: 'mutation', name: 'appUninstall' },
      },
      {
        verb: 'revoke-access-scopes',
        description: 'Revoke app access scopes (Plan 5).',
        operation: { type: 'mutation', name: 'appRevokeAccessScopes' },
        requiredFlags: [flagScopes],
      },
      inputVerb({
        verb: 'create-one-time',
        description: 'Create a one-time purchase.',
        operation: 'appPurchaseOneTimeCreate',
      }),
      inputVerb({
        verb: 'create-subscription',
        description: 'Create an app subscription.',
        operation: 'appSubscriptionCreate',
      }),
      {
        verb: 'cancel-subscription',
        description: 'Cancel an app subscription.',
        operation: { type: 'mutation', name: 'appSubscriptionCancel' },
        requiredFlags: [flagId],
        flags: [flagProrate],
      },
      {
        verb: 'update-line-item',
        description: 'Update a subscription line item.',
        operation: { type: 'mutation', name: 'appSubscriptionLineItemUpdate' },
        flags: [flag('--line-item-id <gid>', 'Line item ID (or use --id)'), flagId, flagAmount, flagCurrency, flagInput],
        notes: ['Provide --line-item-id or --id.', 'Provide --amount/--currency or --input.'],
      },
      {
        verb: 'extend-trial',
        description: 'Extend a subscription trial.',
        operation: { type: 'mutation', name: 'appSubscriptionTrialExtend' },
        requiredFlags: [flagId, flagDays],
      },
      {
        verb: 'create-usage-record',
        description: 'Create a usage record.',
        operation: { type: 'mutation', name: 'appUsageRecordCreate' },
        requiredFlags: [flagSubscriptionLineItemId],
        flags: [flagDescription, flagAmount, flagCurrency, flagIdempotencyKey],
        notes: ['Requires description and price.'],
      },
      {
        verb: 'get-installation',
        description: 'Get the current app installation.',
        operation: { type: 'query', name: 'appInstallation' },
        flags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list-subscriptions',
        description: 'List active app subscriptions.',
        operation: { type: 'query', name: 'appInstallation' },
        flags: [flagId],
        output: { view: true, selection: true },
      },
    ],
  },
  {
    resource: 'apps',
    description: 'Query apps and app installations.',
    verbs: [
      {
        verb: 'get',
        description: 'Fetch an app by ID.',
        operation: { type: 'query', name: 'app' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'by-handle',
        description: 'Fetch an app by handle.',
        operation: { type: 'query', name: 'appByHandle' },
        requiredFlags: [flagHandle],
        output: { view: true, selection: true },
      },
      {
        verb: 'by-key',
        description: 'Fetch an app by API key.',
        operation: { type: 'query', name: 'appByKey' },
        requiredFlags: [flagApiKey],
        output: { view: true, selection: true },
      },
      {
        verb: 'installations',
        description: 'List app installations.',
        operation: { type: 'query', name: 'appInstallations' },
        flags: [flagFirst, flagAfter, flagSort, flagReverse, flagCategory, flagPrivacy],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'current-installation',
        description: 'Fetch the current app installation.',
        operation: { type: 'query', name: 'currentAppInstallation' },
        output: { view: true, selection: true },
      },
      {
        verb: 'discount-type',
        description: 'Fetch an app discount type by function ID.',
        operation: { type: 'query', name: 'appDiscountType' },
        requiredFlags: [flagFunctionId],
        output: { view: true, selection: true },
      },
      {
        verb: 'discount-types',
        description: 'List app discount types.',
        operation: { type: 'query', name: 'appDiscountTypes' },
        output: { view: true, selection: true },
      },
      {
        verb: 'discount-types-nodes',
        description: 'List app discount types via a connection.',
        operation: { type: 'query', name: 'appDiscountTypesNodes' },
        flags: [flagFirst, flagAfter, flagReverse],
        output: { view: true, selection: true, pagination: true },
      },
    ],
  },
  {
    resource: 'channels',
    description: 'Query channels.',
    verbs: [
      getVerb({ operation: 'channel', description: 'Fetch a channel by ID.' }),
      listVerb({ operation: 'channels', description: 'List channels.' }),
    ],
  },
  {
    resource: 'backup',
    description: 'Backup regions and settings.',
    verbs: [
      {
        verb: 'available-regions',
        description: 'List available backup regions.',
        operation: { type: 'query', name: 'availableBackupRegions' },
      },
      {
        verb: 'region',
        description: 'Get the current backup region.',
        operation: { type: 'query', name: 'backupRegion' },
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'region-update',
        description: 'Update the backup region.',
        operation: 'backupRegionUpdate',
        inputArg: 'region',
      }),
    ],
  },
  {
    resource: 'locales',
    description: 'Locale helpers.',
    verbs: [
      {
        verb: 'available',
        description: 'List available locales.',
        operation: { type: 'query', name: 'availableLocales' },
      },
    ],
  },
  {
    resource: 'web-presences',
    description: 'Manage global web presences.',
    verbs: [
      {
        verb: 'list',
        description: 'List web presences.',
        operation: { type: 'query', name: 'webPresences' },
        output: { view: true, selection: true, pagination: true },
      },
      inputVerb({
        verb: 'create',
        description: 'Create a web presence.',
        operation: 'webPresenceCreate',
        inputArg: 'input',
      }),
      inputVerb({
        verb: 'update',
        description: 'Update a web presence.',
        operation: 'webPresenceUpdate',
        requiredFlags: [flagId],
        inputArg: 'input',
      }),
      deleteVerb({ operation: 'webPresenceDelete', description: 'Delete a web presence.' }),
    ],
  },
  {
    resource: 'staged-uploads',
    description: 'Generate staged upload targets.',
    verbs: [
      {
        verb: 'target-generate',
        description: 'Generate a staged upload target.',
        operation: { type: 'mutation', name: 'stagedUploadTargetGenerate' },
        requiredFlags: [flagResource, flagFilename, flagMimeType],
        flags: [flagFileSize, flagHttpMethod, ...inputFlags],
      },
      {
        verb: 'targets-generate',
        description: 'Generate multiple staged upload targets.',
        operation: { type: 'mutation', name: 'stagedUploadTargetsGenerate' },
        requiredFlags: [flagInput],
        notes: ['--input must be a JSON array of StageImageInput objects.'],
      },
    ],
  },
  {
    resource: 'file-saved-searches',
    description: 'Saved searches for files.',
    verbs: [
      {
        verb: 'list',
        description: 'List file saved searches.',
        operation: { type: 'query', name: 'fileSavedSearches' },
        flags: [flagFirst, flagAfter, flagReverse],
        output: { pagination: true },
      },
    ],
  },
  {
    resource: 'metafield-definition-tools',
    description: 'Metafield definition utilities.',
    verbs: [
      {
        verb: 'types',
        description: 'List metafield definition types.',
        operation: { type: 'query', name: 'metafieldDefinitionTypes' },
      },
      {
        verb: 'pin',
        description: 'Pin a metafield definition.',
        operation: { type: 'mutation', name: 'metafieldDefinitionPin' },
        flags: [flagDefinitionId, flagOwnerType, flagNamespace, flagKey],
      },
      {
        verb: 'unpin',
        description: 'Unpin a metafield definition.',
        operation: { type: 'mutation', name: 'metafieldDefinitionUnpin' },
        flags: [flagDefinitionId, flagOwnerType, flagNamespace, flagKey],
      },
      inputVerb({
        verb: 'update',
        description: 'Update a metafield definition (direct).',
        operation: 'metafieldDefinitionUpdate',
        inputArg: 'definition',
        flags: [flagOwnerType, flagNamespace, flagKey],
      }),
      {
        verb: 'standard-templates',
        description: 'List standard metafield definition templates.',
        operation: { type: 'query', name: 'standardMetafieldDefinitionTemplates' },
        flags: [flagConstraintSubtype, flagConstraintStatus, flagExcludeActivated, flagFirst, flagAfter, flagReverse],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'standard-enable',
        description: 'Enable a standard metafield definition.',
        operation: { type: 'mutation', name: 'standardMetafieldDefinitionEnable' },
        requiredFlags: [flagOwnerType],
        flags: [
          flag('--id <id>', 'Template ID'),
          flagNamespace,
          flagKey,
          flag('--pin <bool>', 'Pin definition'),
          flagVisibleToStorefrontApi,
          flagUseAsCollectionCondition,
          ...inputFlags,
        ],
        output: { view: true, selection: true },
      },
    ],
  },
  {
    resource: 'metaobject-definition-tools',
    description: 'Metaobject definition utilities.',
    verbs: [
      {
        verb: 'standard-enable',
        description: 'Enable a standard metaobject definition.',
        operation: { type: 'mutation', name: 'standardMetaobjectDefinitionEnable' },
        requiredFlags: [flagType],
        flags: inputFlags,
        output: { view: true, selection: true },
      },
    ],
  },
  {
    resource: 'metafields',
    description: 'Metafield utilities.',
    verbs: [
      {
        verb: 'delete',
        description: 'Delete metafields by identifier.',
        operation: { type: 'mutation', name: 'metafieldsDelete' },
        requiredFlags: [flagYes],
        flags: [flagOwnerId, flagNamespace, flagKey, ...inputFlags],
        notes: ['Provide --owner-id/--namespace/--key for a single identifier, or pass an identifier array via --input.'],
      },
    ],
  },
  {
    resource: 'shop',
    description: 'Shop-level utilities.',
    verbs: [
      {
        verb: 'billing-preferences',
        description: 'Get shop billing preferences.',
        operation: { type: 'query', name: 'shopBillingPreferences' },
      },
      {
        verb: 'domain',
        description: 'Fetch a domain by ID.',
        operation: { type: 'query', name: 'domain' },
        requiredFlags: [flagId],
        output: { view: true, selection: true },
      },
      {
        verb: 'online-store',
        description: 'Get Online Store configuration.',
        operation: { type: 'query', name: 'onlineStore' },
        output: { view: true, selection: true },
      },
      {
        verb: 'public-api-versions',
        description: 'List public API versions.',
        operation: { type: 'query', name: 'publicApiVersions' },
      },
      {
        verb: 'shop-pay-receipt',
        description: 'Fetch a Shop Pay payment request receipt by token.',
        operation: { type: 'query', name: 'shopPayPaymentRequestReceipt' },
        requiredFlags: [flagToken],
        output: { view: true, selection: true },
      },
      {
        verb: 'shop-pay-receipts',
        description: 'List Shop Pay payment request receipts.',
        operation: { type: 'query', name: 'shopPayPaymentRequestReceipts' },
        flags: [flagFirst, flagAfter, flagQuery, flagSort, flagReverse],
        output: { pagination: true },
      },
    ],
  },
  {
    resource: 'config',
    description: 'Manage shop configuration.',
    verbs: [
      {
        verb: 'get',
        description: 'Get shop configuration.',
        operation: { type: 'query', name: 'shop' },
        output: { view: true, selection: true },
      },
      inputVerb({
        verb: 'update-policy',
        description: 'Update a shop policy.',
        operation: 'shopPolicyUpdate',
        inputArg: 'shopPolicy',
      }),
      {
        verb: 'enable-locale',
        description: 'Enable a locale.',
        operation: { type: 'mutation', name: 'shopLocaleEnable' },
        requiredFlags: [flagLocale],
        flags: [flag('--market-web-presence-ids <gid>', 'Market web presence IDs (repeatable)')],
      },
      {
        verb: 'disable-locale',
        description: 'Disable a locale.',
        operation: { type: 'mutation', name: 'shopLocaleDisable' },
        requiredFlags: [flagLocale],
      },
      inputVerb({
        verb: 'update-locale',
        description: 'Update a locale.',
        operation: 'shopLocaleUpdate',
        requiredFlags: [flagLocale],
        inputArg: 'input',
      }),
      {
        verb: 'get-locales',
        description: 'List shop locales.',
        operation: { type: 'query', name: 'shopLocales' },
      },
    ],
  },
  {
    resource: 'tax',
    description: 'Tax partner configuration and tax summaries.',
    verbs: [
      {
        verb: 'configure-app',
        description: 'Configure tax app readiness.',
        operation: { type: 'mutation', name: 'taxAppConfigure' },
        requiredFlags: [flagReady],
      },
      {
        verb: 'create-summary',
        description: 'Create a tax summary for an order or time range.',
        operation: { type: 'mutation', name: 'taxSummaryCreate' },
        flags: [flagOrderId, flagStartTime, flagEndTime],
        notes: ['Pass either --order-id (or --id) or both --start-time and --end-time.'],
      },
    ],
  },
  {
    resource: 'flow',
    description: 'Shopify Flow integration utilities.',
    verbs: [
      {
        verb: 'generate-signature',
        description: 'Generate a signature for a Flow action payload.',
        operation: { type: 'mutation', name: 'flowGenerateSignature' },
        requiredFlags: [flagId, flag('--payload <string|@file>', 'Payload string (inline or @file)')],
      },
      {
        verb: 'trigger-receive',
        description: 'Trigger a Flow trigger by handle and payload.',
        operation: { type: 'mutation', name: 'flowTriggerReceive' },
        requiredFlags: [flagFlowHandle, flagFlowPayload],
      },
    ],
  },
  {
    resource: 'translations',
    description: 'Manage translations.',
    verbs: [
      {
        verb: 'get',
        description: 'Get translatable resource.',
        operation: { type: 'query', name: 'translatableResource' },
        requiredFlags: [flagResourceId],
        output: { view: true, selection: true },
      },
      {
        verb: 'list',
        description: 'List translatable resources.',
        operation: { type: 'query', name: 'translatableResources' },
        requiredFlags: [flagResourceType],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'list-by-ids',
        description: 'List translatable resources by IDs.',
        operation: { type: 'query', name: 'translatableResourcesByIds' },
        requiredFlags: [flagResourceIds],
        output: { view: true, selection: true, pagination: true },
      },
      {
        verb: 'register',
        description: 'Register translations.',
        operation: { type: 'mutation', name: 'translationsRegister' },
        requiredFlags: [flagResourceId, flag('--translations <json>', 'Translations JSON')],
      },
      {
        verb: 'remove',
        description: 'Remove translations.',
        operation: { type: 'mutation', name: 'translationsRemove' },
        requiredFlags: [flagResourceId, flagTranslationKeys, flagLocales],
        flags: [flagMarketIds],
      },
    ],
  },
  {
    resource: 'events',
    description: 'Query events.',
    verbs: [
      getVerb({ operation: 'event', description: 'Fetch an event by ID.' }),
      listVerb({ operation: 'events', description: 'List events.' }),
      countVerb({ operation: 'eventsCount', description: 'Count events.', flags: [flagQuery] }),
      {
        verb: 'deletion-events',
        description: 'List deletion events.',
        operation: { type: 'query', name: 'deletionEvents' },
        flags: [flagFirst, flagAfter, flagQuery, flagSort, flagReverse, flagSubjectTypes],
        output: { pagination: true },
      },
    ],
  },
  {
    resource: 'functions',
    description: 'List Shopify Functions.',
    verbs: [
      getVerb({ operation: 'shopifyFunction', description: 'Fetch a function by ID.' }),
      {
        ...listVerb({ operation: 'shopifyFunctions', description: 'List Shopify Functions.' }),
        flags: [flagApiType, flagUseCreationUi],
      },
    ],
  },
  {
    resource: 'graphql',
    description: 'Execute raw GraphQL queries and mutations.',
    flags: [
      flag('--var <name>=<value>', 'Set a variable (repeatable)'),
      flag('--var-json <name>=<json>', 'Set a variable with JSON value (repeatable)'),
      flag('--variables <json>', 'Variables as JSON object (or @file.json)'),
      flag('--operation <name>', 'Operation name (for multi-operation documents)'),
      flag('--no-validate', 'Skip local schema validation'),
      flag('--include-extensions', 'Include extensions in output'),
    ],
    notes: [
      'The query can be passed inline or loaded from a file with @filename.',
      'Queries are validated against the bundled schema before execution.',
    ],
    examples: [
      "shop graphql '{ shop { name } }'",
      'shop graphql @query.graphql --variables @vars.json',
      "shop graphql query '{ shop { name } }'",
      "shop graphql mutation @create-product.graphql --var title=Hat",
    ],
    verbs: [
      {
        verb: 'query',
        description: 'Execute a raw GraphQL query.',
        operation: { type: 'query', name: 'raw' },
        flags: [
          flag('<graphql>', 'GraphQL query (inline or @file.graphql)'),
          flag('--var <name>=<value>', 'Set a variable (repeatable)'),
          flag('--var-json <name>=<json>', 'Set a variable with JSON value (repeatable)'),
          flag('--variables <json>', 'Variables as JSON object (or @file.json)'),
          flag('--operation <name>', 'Operation name (for multi-operation documents)'),
          flag('--no-validate', 'Skip local schema validation'),
          flag('--include-extensions', 'Include extensions in output'),
        ],
        examples: [
          'shop graphql query \'{ shop { name } }\'',
          'shop graphql query @get-products.graphql',
          'shop graphql query \'query GetProduct($id: ID!) { product(id: $id) { title } }\' --var id=gid://shopify/Product/123',
        ],
        notes: [
          'The query can be passed as an inline string or loaded from a file with @filename.',
          'Variables can be set individually with --var or as a JSON object with --variables.',
          'Queries are validated against the bundled schema before execution. Use --no-validate to skip.',
        ],
      },
      {
        verb: 'mutation',
        description: 'Execute a raw GraphQL mutation.',
        operation: { type: 'mutation', name: 'raw' },
        flags: [
          flag('<graphql>', 'GraphQL mutation (inline or @file.graphql)'),
          flag('--var <name>=<value>', 'Set a variable (repeatable)'),
          flag('--var-json <name>=<json>', 'Set a variable with JSON value (repeatable)'),
          flag('--variables <json>', 'Variables as JSON object (or @file.json)'),
          flag('--operation <name>', 'Operation name (for multi-operation documents)'),
          flag('--no-validate', 'Skip local schema validation'),
          flag('--include-extensions', 'Include extensions in output'),
        ],
        examples: [
          'shop graphql mutation \'mutation { productCreate(input: { title: "Test" }) { product { id } } }\'',
          'shop graphql mutation @create-product.graphql --variables @vars.json',
        ],
        notes: [
          'The mutation can be passed as an inline string or loaded from a file with @filename.',
          'Use --var for simple string values, --var-json for complex JSON values.',
          'Mutations are validated against the bundled schema before execution. Use --no-validate to skip.',
        ],
      },
      {
        verb: 'nodes',
        description: 'Fetch nodes by ID (Admin API nodes query).',
        operation: { type: 'query', name: 'nodes' },
        requiredFlags: [flagIds],
        output: { view: true, selection: true },
      },
      {
        verb: 'shopifyql',
        description: 'Run a ShopifyQL query.',
        operation: { type: 'query', name: 'shopifyqlQuery' },
        requiredFlags: [flag('--query <string>', 'ShopifyQL query')],
      },
    ],
  },
  {
    resource: 'types',
    description: 'Explore input types and enums from the Shopify Admin API schema.',
    verbs: [
      {
        verb: 'help',
        description: 'Show help for exploring schema types.',
        examples: ['shop types --help', 'shop types ProductStatus', 'shop types CountryCode --all'],
      },
    ],
  },
]

export const commandRegistry: ResourceSpec[] = baseCommandRegistry.map((spec) => {
  if (!resourcesWithFields.has(spec.resource)) return spec
  if (spec.verbs.some((v) => v.verb === fieldsVerb.verb)) return spec
  return { ...spec, verbs: [...spec.verbs, fieldsVerb] }
})

export const commonOutputFlags = [flagFormat, flagView, flagSelect, flagInclude, flagSelection, flagQuiet]
export const paginationFlags = [flagFirst, flagAfter, flagQuery, flagSort, flagReverse]
export const standardInputFlags = inputFlags
