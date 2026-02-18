import type { FlagSpec, ResourceSpec, VerbSpec } from './spec'

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
const flagSort = flag('--sort <key>', 'Sort key')
const flagReverse = flag('--reverse', 'Reverse sort order')
const flagView = flag('--view summary|ids|full|raw', 'Select a built-in view')
const flagSelect = flag('--select <path>', 'Add fields to the selection (repeatable)')
const flagSelection = flag('--selection <graphql>', 'Override selection (can be @file.gql)')
const flagTags = flag('--tags <csv>', 'Comma-separated tags')
const flagStatus = flag('--status <value>', 'Status value')
const flagNewTitle = flag('--new-title <string>', 'Title for the duplicate')

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
}: {
  operation: string
  inputArg?: string
  description?: string
  requiredFlags?: FlagSpec[]
  flags?: FlagSpec[]
  examples?: string[]
  notes?: string[]
}): VerbSpec => ({
  verb: 'update',
  description,
  operation: { type: 'mutation', name: operation, inputArg },
  input: { mode: 'set', arg: inputArg, required: true },
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
}: {
  operation: string
  description?: string
  notes?: string[]
}): VerbSpec => ({
  verb: 'list',
  description,
  operation: { type: 'query', name: operation },
  output: { view: true, selection: true, pagination: true },
  notes,
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

export const commandRegistry: ResourceSpec[] = [
  {
    resource: 'products',
    description: 'Manage products.',
    verbs: [
      createVerb({ operation: 'productCreate', description: 'Create a new product.' }),
      getVerb({ operation: 'product', description: 'Fetch a product by ID.' }),
      listVerb({ operation: 'products', description: 'List products.' }),
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
        verb: 'set-status',
        description: 'Set product status.',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId, flagStatus],
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
        verb: 'publish',
        description: 'Publish a product to specific publications.',
        operation: { type: 'mutation', name: 'publishablePublish' },
        requiredFlags: [flagId],
        flags: [
          flag('--publication-id <gid>', 'Publication ID (repeatable)'),
          flag('--publication <name>', 'Publication name (repeatable; resolves by name)'),
          flag('--at <iso>', 'Publish at a specific ISO timestamp'),
          flag('--now', 'Publish immediately'),
        ],
        notes: ['Pass either --publication-id or --publication (name).'],
      },
      {
        verb: 'unpublish',
        description: 'Unpublish a product from specific publications.',
        operation: { type: 'mutation', name: 'publishableUnpublish' },
        requiredFlags: [flagId],
        flags: [
          flag('--publication-id <gid>', 'Publication ID (repeatable)'),
          flag('--publication <name>', 'Publication name (repeatable; resolves by name)'),
        ],
        notes: ['Pass either --publication-id or --publication (name).'],
      },
      {
        verb: 'publish-all',
        description: 'Publish a product to all publications.',
        operation: { type: 'mutation', name: 'publishablePublish' },
        requiredFlags: [flagId],
        flags: [
          flag('--at <iso>', 'Publish at a specific ISO timestamp'),
          flag('--now', 'Publish immediately'),
        ],
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
        requiredFlags: [flagId, flag('--url <url>', 'Media URL (repeatable)')],
        flags: [
          flag('--alt <string>', 'Alt text for media'),
          flag('--media-type <type>', 'IMAGE|VIDEO|MODEL_3D|EXTERNAL_VIDEO (default: IMAGE)'),
        ],
      },
      {
        verb: 'media upload',
        description: 'Upload local files as product media.',
        operation: { type: 'mutation', name: 'productUpdate' },
        requiredFlags: [flagId, flag('--file <path>', 'Local file path (repeatable)')],
        flags: [
          flag('--alt <string>', 'Alt text for media'),
          flag('--content-type <mime>', 'Override detected content type'),
          flag('--media-type <type>', 'IMAGE|VIDEO|MODEL_3D|EXTERNAL_VIDEO'),
        ],
      },
    ],
  },
  {
    resource: 'product-variants',
    description: 'Bulk upsert product variants.',
    verbs: [
      {
        verb: 'upsert',
        description: 'Create or update product variants in bulk.',
        operation: { type: 'mutation', name: 'productVariantsBulkCreate', inputArg: 'variants' },
        input: { mode: 'set', arg: 'variants', required: true },
        requiredFlags: [flag('--product-id <gid>', 'Parent product ID')],
        flags: [
          flag('--allow-partial-updates', 'Allow partial updates during bulk update'),
          flag('--strategy <value>', 'DEFAULT|PRESERVE_STANDALONE_VARIANT|REMOVE_STANDALONE_VARIANT'),
        ],
        notes: ['Input can be an array or { variants: [...] }.'],
      },
    ],
  },
  {
    resource: 'collections',
    description: 'Manage collections.',
    verbs: [
      createVerb({ operation: 'collectionCreate', description: 'Create a collection.' }),
      getVerb({ operation: 'collection', description: 'Fetch a collection by ID.' }),
      listVerb({ operation: 'collections', description: 'List collections.' }),
      updateVerb({ operation: 'collectionUpdate', description: 'Update a collection.' }),
      deleteVerb({ operation: 'collectionDelete', description: 'Delete a collection.' }),
      duplicateVerb({
        operation: 'collectionDuplicate',
        description: 'Duplicate a collection.',
        flags: [flag('--copy-publications', 'Copy publication settings to the duplicate')],
      }),
    ],
  },
  {
    resource: 'customers',
    description: 'Manage customers.',
    verbs: [
      createVerb({ operation: 'customerCreate', description: 'Create a customer.' }),
      getVerb({ operation: 'customer', description: 'Fetch a customer by ID.' }),
      listVerb({ operation: 'customers', description: 'List customers.' }),
      updateVerb({ operation: 'customerUpdate', description: 'Update a customer.' }),
      deleteVerb({ operation: 'customerDelete', description: 'Delete a customer.' }),
    ],
  },
  {
    resource: 'orders',
    description: 'Manage orders.',
    verbs: [
      createVerb({ operation: 'orderCreate', description: 'Create an order.' }),
      getVerb({ operation: 'order', description: 'Fetch an order by ID.' }),
      listVerb({ operation: 'orders', description: 'List orders.' }),
      updateVerb({ operation: 'orderUpdate', description: 'Update an order.' }),
      deleteVerb({ operation: 'orderDelete', description: 'Delete an order.' }),
    ],
  },
  {
    resource: 'inventory',
    description: 'Adjust inventory quantities.',
    verbs: [
      {
        verb: 'set',
        description: 'Set available inventory to an absolute quantity.',
        operation: { type: 'mutation', name: 'inventorySetQuantities' },
        requiredFlags: [
          flag('--location-id <gid>', 'Location ID'),
          flag('--available <int>', 'Absolute available quantity'),
        ],
        flags: [
          flag('--inventory-item-id <gid>', 'Inventory item ID (or use --variant-id)'),
          flag('--variant-id <gid>', 'Product variant ID (alternative to --inventory-item-id)'),
          flag('--reason <value>', 'Adjustment reason (default: correction)'),
          flag('--reference-document-uri <url>', 'Reference document URL'),
        ],
        notes: ['Pass either --inventory-item-id or --variant-id.'],
      },
      {
        verb: 'adjust',
        description: 'Adjust available inventory by a delta.',
        operation: { type: 'mutation', name: 'inventoryAdjustQuantities' },
        requiredFlags: [
          flag('--location-id <gid>', 'Location ID'),
          flag('--delta <int>', 'Quantity delta (positive or negative)'),
        ],
        flags: [
          flag('--inventory-item-id <gid>', 'Inventory item ID (or use --variant-id)'),
          flag('--variant-id <gid>', 'Product variant ID (alternative to --inventory-item-id)'),
          flag('--reason <value>', 'Adjustment reason (default: correction)'),
          flag('--reference-document-uri <url>', 'Reference document URL'),
        ],
        notes: ['Pass either --inventory-item-id or --variant-id.'],
      },
    ],
  },
  {
    resource: 'files',
    description: 'Upload files.',
    verbs: [
      {
        verb: 'upload',
        description: 'Upload local files to Shopify.',
        operation: { type: 'mutation', name: 'fileCreate' },
        requiredFlags: [flag('--file <path>', 'Local file path (repeatable)')],
        flags: [
          flag('--alt <string>', 'Alt text for the file'),
          flag('--content-type <mime>', 'Override detected content type'),
        ],
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
      updateVerb({ operation: 'publicationUpdate', description: 'Update a publication.' }),
      deleteVerb({ operation: 'publicationDelete', description: 'Delete a publication.' }),
    ],
  },
  {
    resource: 'articles',
    description: 'Manage blog articles.',
    verbs: [
      createVerb({ operation: 'articleCreate', description: 'Create an article.' }),
      getVerb({ operation: 'article', description: 'Fetch an article by ID.' }),
      listVerb({ operation: 'articles', description: 'List articles.' }),
      updateVerb({ operation: 'articleUpdate', description: 'Update an article.' }),
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
      updateVerb({ operation: 'blogUpdate', description: 'Update a blog.' }),
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
      updateVerb({ operation: 'pageUpdate', description: 'Update a page.' }),
      deleteVerb({ operation: 'pageDelete', description: 'Delete a page.' }),
    ],
  },
  {
    resource: 'comments',
    description: 'Manage comments.',
    verbs: [
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
        ...createVerb({ operation: 'menuCreate', description: 'Create a menu.' }),
        input: { mode: 'set', required: true },
        notes: ['Use --set title=..., --set handle=..., --set items=[...].'],
      },
      getVerb({ operation: 'menu', description: 'Fetch a menu by ID.' }),
      listVerb({ operation: 'menus', description: 'List menus.' }),
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
      updateVerb({ operation: 'marketUpdate', description: 'Update a market.' }),
      deleteVerb({ operation: 'marketDelete', description: 'Delete a market.' }),
    ],
  },
  {
    resource: 'draft-orders',
    description: 'Manage draft orders.',
    verbs: [
      getVerb({ operation: 'draftOrder', description: 'Fetch a draft order by ID.' }),
      listVerb({ operation: 'draftOrders', description: 'List draft orders.' }),
      {
        verb: 'count',
        description: 'Count draft orders.',
        operation: { type: 'query', name: 'draftOrdersCount' },
        flags: [flagQuery],
      },
      createVerb({ operation: 'draftOrderCreate', description: 'Create a draft order.' }),
      {
        ...updateVerb({ operation: 'draftOrderUpdate', description: 'Update a draft order.' }),
      },
      deleteVerb({ operation: 'draftOrderDelete', description: 'Delete a draft order.' }),
      duplicateVerb({ operation: 'draftOrderDuplicate', description: 'Duplicate a draft order.' }),
      {
        verb: 'calculate',
        description: 'Calculate a draft order without saving.',
        operation: { type: 'mutation', name: 'draftOrderCalculate', inputArg: 'input' },
        input: { mode: 'set', arg: 'input', required: true },
      },
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
        requiredFlags: [flag('--order-id <gid>', 'Order ID')],
      },
      {
        verb: 'preview-invoice',
        description: 'Preview a draft order invoice.',
        operation: { type: 'mutation', name: 'draftOrderInvoicePreview' },
        requiredFlags: [flagId],
      },
      {
        verb: 'send-invoice',
        description: 'Send a draft order invoice.',
        operation: { type: 'mutation', name: 'draftOrderInvoiceSend' },
        requiredFlags: [flagId],
      },
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
      {
        verb: 'delivery-options',
        description: 'List available delivery options for a draft order.',
        operation: { type: 'query', name: 'draftOrderAvailableDeliveryOptions', inputArg: 'input' },
        input: { mode: 'set', arg: 'input', required: true },
      },
    ],
  },
  {
    resource: 'url-redirects',
    description: 'Manage URL redirects.',
    verbs: [
      createVerb({ operation: 'urlRedirectCreate', description: 'Create a URL redirect.' }),
      getVerb({ operation: 'urlRedirect', description: 'Fetch a URL redirect by ID.' }),
      listVerb({ operation: 'urlRedirects', description: 'List URL redirects.' }),
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
      updateVerb({ operation: 'segmentUpdate', description: 'Update a segment.' }),
      deleteVerb({ operation: 'segmentDelete', description: 'Delete a segment.' }),
    ],
  },
  {
    resource: 'webhooks',
    description: 'Manage webhook subscriptions.',
    verbs: [
      createVerb({
        operation: 'webhookSubscriptionCreate',
        inputArg: 'webhookSubscription',
        description: 'Create a webhook subscription.',
        requiredFlags: [flag('--topic <topic>', 'Webhook topic')],
      }),
      getVerb({ operation: 'webhookSubscription', description: 'Fetch a webhook subscription by ID.' }),
      listVerb({ operation: 'webhookSubscriptions', description: 'List webhook subscriptions.' }),
      updateVerb({
        operation: 'webhookSubscriptionUpdate',
        inputArg: 'webhookSubscription',
        description: 'Update a webhook subscription.',
      }),
      deleteVerb({ operation: 'webhookSubscriptionDelete', description: 'Delete a webhook subscription.' }),
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
        flags: [flag('--owner-type <type>', 'Owner type filter')],
      },
      {
        verb: 'update',
        description: 'Update a metafield definition.',
        operation: { type: 'mutation', name: 'metafieldDefinitionUpdate', inputArg: 'definition' },
        input: { mode: 'set', arg: 'definition', required: true },
        flags: [
          flag('--id <gid>', 'Definition ID (optional; otherwise use key/namespace/owner-type)'),
          flag('--key <string>', 'Definition key'),
          flag('--namespace <string>', 'Definition namespace'),
          flag('--owner-type <type>', 'Definition owner type'),
        ],
        notes: ['Pass either --id or all of --key, --namespace, and --owner-type.'],
      },
      deleteVerb({
        operation: 'metafieldDefinitionDelete',
        description: 'Delete a metafield definition.',
      }),
    ],
  },
  {
    resource: 'metaobjects',
    description: 'Manage metaobjects.',
    verbs: [
      createVerb({
        operation: 'metaobjectCreate',
        inputArg: 'metaobject',
        description: 'Create a metaobject.',
      }),
      getVerb({ operation: 'metaobject', description: 'Fetch a metaobject by ID.' }),
      {
        ...listVerb({ operation: 'metaobjects', description: 'List metaobjects.' }),
        requiredFlags: [flag('--type <string>', 'Metaobject type')],
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
        requiredFlags: [flagId, flag('--variant-ids <gid>', 'Variant IDs (repeatable)')],
      },
      {
        verb: 'remove-variants',
        description: 'Remove variants from a selling plan group.',
        operation: { type: 'mutation', name: 'sellingPlanGroupRemoveProductVariants' },
        requiredFlags: [flagId, flag('--variant-ids <gid>', 'Variant IDs (repeatable)')],
      },
    ],
  },
  {
    resource: 'graphql',
    description: 'Execute raw GraphQL queries and mutations.',
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
          flag('--include-extensions', 'Include extensions in output'),
        ],
        examples: [
          'shop graphql mutation \'mutation { productCreate(input: { title: "Test" }) { product { id } } }\'',
          'shop graphql mutation @create-product.graphql --variables @vars.json',
        ],
        notes: [
          'The mutation can be passed as an inline string or loaded from a file with @filename.',
          'Use --var for simple string values, --var-json for complex JSON values.',
        ],
      },
    ],
  },
]

export const commonOutputFlags = [flagView, flagSelect, flagSelection]
export const paginationFlags = [flagFirst, flagAfter, flagQuery, flagSort, flagReverse]
export const standardInputFlags = inputFlags
