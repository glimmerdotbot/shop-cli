import { CliError } from '../errors'
import { assertShopifyGidTypeIn, coerceGid, type ShopifyGidType } from '../gid'
import { renderVerbGroupHelp } from '../help/render'
import { buildInput } from '../input'
import { parseJson5 } from '../json'
import { printConnection, printIds, printJson, printNode } from '../output'
import { applyComputedFieldsToNode, computedPublicationsSelection } from '../output/computedFields'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import {
  buildLocalFilesForStagedUpload,
  stagedUploadLocalFiles,
  type StagedUploadResource,
} from '../workflows/files/stagedUploads'
import { waitForFilesReadyOrFailed } from '../workflows/files/waitForReady'
import { writeStdinToTempFile } from '../workflows/files/stdinFile'
import { metafieldsUpsert } from '../workflows/products/metafieldsUpsert'
import {
  parsePublishDate,
  publishProduct,
  resolvePublicationIds,
  unpublishProduct,
} from '../workflows/products/publishablePublish'
import { listPublications } from '../workflows/publications/resolvePublicationId'

import {
  buildListNextPageArgs,
  parseFirst,
  parseIds,
  parseIntFlag,
  parseJsonArg,
  parseStringList,
  requireGidFlag,
  requireId,
} from './_shared'

type MediaContentType = 'IMAGE' | 'VIDEO' | 'MODEL_3D' | 'EXTERNAL_VIDEO'

const normalizeProductInput = (input: any) => {
  if (!input || typeof input !== 'object') return input

  // Back-compat: ProductInput uses descriptionHtml, but many scripts still use bodyHtml
  // (bodyHtml exists on Product and is deprecated in favor of descriptionHtml).
  const hasBodyHtml = Object.prototype.hasOwnProperty.call(input, 'bodyHtml')
  const hasDescriptionHtml = Object.prototype.hasOwnProperty.call(input, 'descriptionHtml')

  if (!hasBodyHtml) return input

  if (hasDescriptionHtml) {
    const a = (input as any).bodyHtml
    const b = (input as any).descriptionHtml
    if (a !== b) throw new CliError('Conflicting bodyHtml and descriptionHtml; use descriptionHtml.', 2)
    delete (input as any).bodyHtml
    return input
  }

  ;(input as any).descriptionHtml = (input as any).bodyHtml
  delete (input as any).bodyHtml
  return input
}

const requireProductIdForSubverb = (args: any) => {
  if (args.id !== undefined) {
    throw new CliError('Unknown flag --id, did you mean --product-id?', 2)
  }
  return requireGidFlag((args as any)['product-id'], '--product-id', 'Product')
}

const requireProductIdForRootVerb = (args: any) => {
  const rawId = args.id as unknown
  const rawProductId = (args as any)['product-id'] as unknown

  const hasId = typeof rawId === 'string' && rawId.length > 0
  const hasProductId = typeof rawProductId === 'string' && rawProductId.length > 0

  if (!hasId && !hasProductId) {
    throw new CliError('Missing --id', 2)
  }

  if (hasId && hasProductId) {
    const a = coerceGid(rawId, 'Product')
    const b = coerceGid(rawProductId, 'Product')
    if (a !== b) throw new CliError('Conflicting --id and --product-id', 2)
    return a
  }

  if (hasProductId) {
    return requireGidFlag(rawProductId, '--product-id', 'Product')
  }

  return requireId(rawId, 'Product')
}

const productMediaSummarySelection = {
  id: true,
  mediaContentType: true,
  status: true,
  alt: true,
  preview: { status: true, image: { url: true } },
} as const

const productMediaSelection = {
  mediaErrors: { code: true, message: true },
  mediaWarnings: { code: true, message: true },
  ...productMediaSummarySelection,
} as const

const productSummarySelection = {
  id: true,
  title: true,
  handle: true,
  status: true,
  updatedAt: true,
} as const

const productSummarySelectionForGet = {
  ...productSummarySelection,
  ...computedPublicationsSelection,
} as const

const productFullSelection = {
  ...productSummarySelection,
  createdAt: true,
  tags: true,
} as const

const productFullSelectionForGet = {
  ...productFullSelection,
  ...computedPublicationsSelection,
} as const

const productTagsSummarySelection = {
  ...productSummarySelection,
  tags: true,
} as const

const productOptionSelection = {
  id: true,
  name: true,
  position: true,
  values: true,
} as const

const productOptionListSummarySelection = {
  id: true,
  name: true,
  position: true,
  values: true,
} as const

const productOptionListFullSelection = {
  ...productOptionListSummarySelection,
  optionValues: { id: true, name: true, hasVariants: true },
} as const

const getProductOptionListSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productOptionListFullSelection
  if (view === 'raw') return {} as const
  return productOptionListSummarySelection
}

const productOptionsSummarySelection = {
  ...productSummarySelection,
  options: {
    __args: { first: 100 },
    ...productOptionSelection,
  },
} as const

const productOptionsFullSelection = {
  ...productFullSelection,
  options: {
    __args: { first: 100 },
    ...productOptionSelection,
  },
} as const

const productVariantSummarySelection = {
  id: true,
  displayName: true,
  sku: true,
  price: true,
  availableForSale: true,
} as const

const productVariantFullSelection = {
  ...productVariantSummarySelection,
  barcode: true,
  compareAtPrice: true,
  inventoryQuantity: true,
  product: { id: true, title: true },
  inventoryItem: { id: true },
} as const

const getProductVariantSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productVariantFullSelection
  if (view === 'raw') return {} as const
  return productVariantSummarySelection
}

const getProductSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productFullSelection
  if (view === 'raw') return {} as const
  return productSummarySelection
}

const getProductSelectionForTags = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productFullSelection
  if (view === 'raw') return {} as const
  return productTagsSummarySelection
}

const getProductSelectionForOptions = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productOptionsFullSelection
  if (view === 'raw') return {} as const
  return productOptionsSummarySelection
}

const getProductSelectionForGet = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productFullSelectionForGet
  if (view === 'raw') return {} as const
  return productSummarySelectionForGet
}

const getProductMediaSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'summary') return productMediaSummarySelection
  return productMediaSelection
}

const parseTags = (tags: string | undefined) => {
  if (!tags) throw new CliError('Missing --tags', 2)
  const parts = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new CliError('--tags must include at least one tag', 2)
  return parts
}

const normalizeMediaContentType = (value: string | undefined): MediaContentType => {
  if (!value) return 'IMAGE'
  const v = value.toUpperCase()
  if (v === 'IMAGE' || v === 'VIDEO' || v === 'MODEL_3D' || v === 'EXTERNAL_VIDEO') return v
  throw new CliError('--media-content-type/--media-type must be IMAGE|VIDEO|MODEL_3D|EXTERNAL_VIDEO', 2)
}

const parsePositiveIntFlag = ({
  value,
  flag,
}: {
  value: unknown
  flag: string
}): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new CliError(`Invalid ${flag} value`, 2)
  const trimmed = value.trim()
  if (!trimmed) throw new CliError(`Invalid ${flag} value`, 2)
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new CliError(`${flag} must be a positive integer`, 2)
  }
  return n
}

const getTopProductMediaIds = async ({
  ctx,
  productId,
  first = 250,
}: {
  ctx: CommandContext
  productId: string
  first?: number
}): Promise<string[]> => {
  const result = await runQuery(ctx, {
    product: {
      __args: { id: productId },
      media: {
        __args: { first, reverse: true, sortKey: 'POSITION' as any },
        nodes: { id: true },
      },
    },
  })
  if (result === undefined) return []
  const nodes = (result.product?.media?.nodes ?? []) as any[]
  return nodes
    .map((n) => (typeof n?.id === 'string' ? (n.id as string) : undefined))
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
}

const allowedMediaGidTypes = ['MediaImage', 'Video', 'ExternalVideo', 'Model3d'] as const satisfies readonly ShopifyGidType[]

const normalizeMediaId = (value: string, label = 'Media ID') => {
  const raw = value.trim()
  if (!raw) throw new CliError(`${label} cannot be empty`, 2)
  if (raw.startsWith('gid://')) return assertShopifyGidTypeIn(raw, allowedMediaGidTypes, label)
  // Numeric IDs are ambiguous - could be MediaImage, Video, Model3d, etc.
  // Require the full GID from `media list` output to avoid confusion.
  throw new CliError(
    `Numeric media ID "${raw}" is ambiguous. Use the full GID from "shop products media list" (e.g. gid://shopify/MediaImage/${raw})`,
    2,
  )
}

const mediaTypeToStagedResource = (mediaType: MediaContentType): StagedUploadResource => {
  if (mediaType === 'IMAGE') return 'IMAGE'
  if (mediaType === 'VIDEO') return 'VIDEO'
  if (mediaType === 'MODEL_3D') return 'MODEL_3D'
  throw new CliError('--media-type EXTERNAL_VIDEO cannot be used with --file uploads', 2)
}

const stagedResourceToMediaType = (resource: StagedUploadResource): MediaContentType => {
  if (resource === 'IMAGE') return 'IMAGE'
  if (resource === 'VIDEO') return 'VIDEO'
  if (resource === 'MODEL_3D') return 'MODEL_3D'
  throw new CliError('Only IMAGE|VIDEO|MODEL_3D can be uploaded as product media', 2)
}

const parseVariantOptionValues = (value: unknown) => {
  if (value === undefined || value === null) return [] as Array<{ optionName: string; name: string }>
  const raw = Array.isArray(value) ? value : [value]
  const optionValues: Array<{ optionName: string; name: string }> = []

  for (const entry of raw) {
    if (typeof entry !== 'string') throw new CliError('--variant-option must be a string', 2)
    const trimmed = entry.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0 || eq === trimmed.length - 1) {
      throw new CliError(`--variant-option must be in the form OptionName=Value. Got: ${entry}`, 2)
    }
    const optionName = trimmed.slice(0, eq).trim()
    const name = trimmed.slice(eq + 1).trim()
    if (!optionName || !name) {
      throw new CliError(`--variant-option must be in the form OptionName=Value. Got: ${entry}`, 2)
    }
    optionValues.push({ optionName, name })
  }

  return optionValues
}

const parseRepeatableStrings = (
  value: unknown,
  flag: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) => {
  if (value === undefined || value === null) {
    if (allowEmpty) return [] as string[]
    throw new CliError(`Missing ${flag}`, 2)
  }

  const raw = Array.isArray(value) ? value : [value]
  const out: string[] = []

  for (const entry of raw) {
    if (typeof entry !== 'string') throw new CliError(`${flag} must be a string (repeatable)`, 2)
    const trimmed = entry.trim()
    if (!trimmed) throw new CliError(`${flag} cannot be empty`, 2)
    out.push(trimmed)
  }

  if (out.length === 0) {
    if (allowEmpty) return []
    throw new CliError(`Missing ${flag}`, 2)
  }

  return out
}

const parseOptionSpec = (value: string, flag: string) => {
  const trimmed = value.trim()
  const eq = trimmed.indexOf('=')
  if (eq <= 0 || eq === trimmed.length - 1) {
    throw new CliError(`${flag} must be in the form Name=Value1,Value2,... Got: ${value}`, 2)
  }
  const name = trimmed.slice(0, eq).trim()
  const valuesRaw = trimmed.slice(eq + 1).trim()
  if (!name || !valuesRaw) {
    throw new CliError(`${flag} must be in the form Name=Value1,Value2,... Got: ${value}`, 2)
  }
  const valueNames = valuesRaw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (valueNames.length === 0) {
    throw new CliError(`${flag} must include at least one value. Got: ${value}`, 2)
  }
  return {
    name,
    values: valueNames.map((v) => ({ name: v })),
  }
}

const parseFromTo = (value: string, flag: string) => {
  const trimmed = value.trim()
  const eq = trimmed.indexOf('=')
  if (eq <= 0 || eq === trimmed.length - 1) {
    throw new CliError(`${flag} must be in the form From=To. Got: ${value}`, 2)
  }
  const from = trimmed.slice(0, eq).trim()
  const to = trimmed.slice(eq + 1).trim()
  if (!from || !to) {
    throw new CliError(`${flag} must be in the form From=To. Got: ${value}`, 2)
  }
  return { from, to }
}

const looksLikeGidOrNumericId = (value: string) => /^gid:\/\//i.test(value) || /^\d+$/.test(value)

const normalizeProductOptionCreateVariantStrategy = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new CliError('--variant-strategy must be a string', 2)
  const v = value.trim().toUpperCase()
  if (v === 'LEAVE_AS_IS' || v === 'CREATE') return v
  throw new CliError('--variant-strategy must be LEAVE_AS_IS|CREATE', 2)
}

const normalizeProductOptionUpdateVariantStrategy = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new CliError('--variant-strategy must be a string', 2)
  const v = value.trim().toUpperCase()
  if (v === 'LEAVE_AS_IS' || v === 'MANAGE') return v
  throw new CliError('--variant-strategy must be LEAVE_AS_IS|MANAGE', 2)
}

const normalizeProductOptionDeleteStrategy = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new CliError('--strategy must be a string', 2)
  const v = value.trim().toUpperCase()
  if (v === 'DEFAULT' || v === 'NON_DESTRUCTIVE' || v === 'POSITION') return v
  throw new CliError('--strategy must be DEFAULT|NON_DESTRUCTIVE|POSITION', 2)
}

const productOptionResolveSelection = {
  id: true,
  name: true,
  position: true,
  values: true,
  optionValues: { id: true, name: true },
} as const

const fetchProductOptionsForResolution = async ({ ctx, productId }: { ctx: CommandContext; productId: string }) => {
  const result = await runQuery(ctx, {
    product: { __args: { id: productId }, options: productOptionResolveSelection },
  })
  if (result === undefined) return [] as any[]
  return (result.product?.options ?? []) as any[]
}

const resolveSingleOptionByName = (options: any[], name: string) => {
  const matches = options.filter((o) => typeof o?.name === 'string' && o.name === name)
  if (matches.length === 0) return undefined
  if (matches.length > 1) {
    throw new CliError(`Multiple product options named "${name}" exist. Use --option-id instead.`, 2)
  }
  return matches[0]
}

const parseInventoryPolicy = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new CliError('--inventory-policy must be a string', 2)
  const normalized = value.trim().toUpperCase()
  if (normalized === 'DENY' || normalized === 'CONTINUE') return normalized
  throw new CliError(`--inventory-policy must be DENY|CONTINUE. Got: ${value}`, 2)
}

export const runProducts = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  const groupHelpVerbs = new Set(['variants', 'options', 'media'])
  if (groupHelpVerbs.has(verb)) {
    const groupHelp = renderVerbGroupHelp('products', verb)
    if (groupHelp) console.log(groupHelp)

    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return
    throw new CliError(`\nMissing <verb> for "products ${verb}"`, 2)
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop products <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete|duplicate|set-status|archive|unarchive',
        '  by-handle|by-identifier|operation|duplicate-job',
        '  tags|types|vendors',
        '  change-status|set',
        '  join-selling-plan-groups|leave-selling-plan-groups',
        '  options list|options create|options update|options delete|options reorder',
        '  variants list|variants create|variants update|variants delete|variants reorder',
        '  combined-listing-update',
        '  add-tags|remove-tags|set-price',
        '  publish|unpublish|publish-all',
        '  bundle-create|bundle-update',
        '  metafields upsert',
        '  media add|media upload|media list|media remove|media reorder|media update',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'variants list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'product-id': { type: 'string' } },
    })

    if (args.query) {
      throw new CliError(
        '--query is not supported for `shop products variants list` (product-scoped variants). Use `shop product-variants list --query ...` for global variant search.',
        2,
      )
    }

    const productId = requireProductIdForSubverb(args)
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      typeName: 'ProductVariant',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, {
      product: {
        __args: { id: productId },
        variants: {
          __args: { first, after, reverse, sortKey },
          pageInfo: { hasNextPage: true, endCursor: true },
          nodes: nodeSelection,
        },
      },
    })
    if (result === undefined) return
    const connection = result.product?.variants
    if (!connection) throw new CliError('Product not found', 2)

    printConnection({
      connection,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop products variants list',
        first,
        sort: typeof sortKey === 'string' ? sortKey : undefined,
        reverse: reverse === true,
        extraFlags: [{ flag: '--product-id', value: productId }],
      },
    })
    return
  }

  if (verb === 'variants create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'variant-option': { type: 'string', multiple: true },
        sku: { type: 'string' },
        barcode: { type: 'string' },
        price: { type: 'string' },
        'compare-at-price': { type: 'string' },
        'inventory-policy': { type: 'string' },
        strategy: { type: 'string' },
      },
    })

    const productId = requireProductIdForSubverb(args)
    const optionValues = parseVariantOptionValues((args as any)['variant-option'])
    if (optionValues.length === 0) {
      throw new CliError('Missing --variant-option OptionName=Value (repeatable)', 2)
    }

    const sku = (args as any).sku as string | undefined
    const barcode = (args as any).barcode as string | undefined
    const price = (args as any).price as string | undefined
    const compareAtPrice = (args as any)['compare-at-price'] as string | undefined
    const inventoryPolicy = parseInventoryPolicy((args as any)['inventory-policy'])

    const strategy = (args as any).strategy as string | undefined
    if (
      strategy &&
      !['DEFAULT', 'PRESERVE_STANDALONE_VARIANT', 'REMOVE_STANDALONE_VARIANT'].includes(
        strategy.trim().toUpperCase(),
      )
    ) {
      throw new CliError(
        `--strategy must be DEFAULT|PRESERVE_STANDALONE_VARIANT|REMOVE_STANDALONE_VARIANT. Got: ${strategy}`,
        2,
      )
    }
    const normalizedStrategy = strategy ? strategy.trim().toUpperCase() : undefined

    const variantSelection = resolveSelection({
      typeName: 'ProductVariant',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const variantInput: any = {
      optionValues,
      ...(barcode ? { barcode } : {}),
      ...(price ? { price } : {}),
      ...(compareAtPrice ? { compareAtPrice } : {}),
      ...(inventoryPolicy ? { inventoryPolicy } : {}),
      ...(sku ? { inventoryItem: { sku } } : {}),
    }

    const result = await runMutation(ctx, {
      productVariantsBulkCreate: {
        __args: {
          productId,
          variants: [variantInput],
          ...(normalizedStrategy ? { strategy: normalizedStrategy } : {}),
        },
        userErrors: { field: true, message: true },
        productVariants: variantSelection,
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    const created = result.productVariantsBulkCreate?.productVariants?.[0]
    printNode({ node: created, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'variants update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'variant-id': { type: 'string' },
        'variant-option': { type: 'string', multiple: true },
        sku: { type: 'string' },
        barcode: { type: 'string' },
        price: { type: 'string' },
        'compare-at-price': { type: 'string' },
        'inventory-policy': { type: 'string' },
        'allow-partial-updates': { type: 'boolean' },
      },
    })

    // For this subverb, treat `--id` as a legacy alias for `--product-id`
    // so users get the more relevant "Missing --variant-id" error.
    if ((args as any).id !== undefined) {
      if ((args as any)['product-id'] !== undefined) {
        throw new CliError('Unknown flag --id, did you mean --variant-id?', 2)
      }
      ;(args as any)['product-id'] = (args as any).id
      delete (args as any).id
    }

    const productId = requireProductIdForSubverb(args)
    const variantId = requireId((args as any)['variant-id'], 'ProductVariant', '--variant-id')
    const optionValues = parseVariantOptionValues((args as any)['variant-option'])
    const sku = (args as any).sku as string | undefined
    const barcode = (args as any).barcode as string | undefined
    const price = (args as any).price as string | undefined
    const compareAtPrice = (args as any)['compare-at-price'] as string | undefined
    const inventoryPolicy = parseInventoryPolicy((args as any)['inventory-policy'])

    const allowPartialUpdates = (args as any)['allow-partial-updates'] === true

    const variantSelection = resolveSelection({
      typeName: 'ProductVariant',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const variantInput: any = {
      id: variantId,
      ...(optionValues.length ? { optionValues } : {}),
      ...(barcode ? { barcode } : {}),
      ...(price ? { price } : {}),
      ...(compareAtPrice ? { compareAtPrice } : {}),
      ...(inventoryPolicy ? { inventoryPolicy } : {}),
      ...(sku ? { inventoryItem: { sku } } : {}),
    }

    const result = await runMutation(ctx, {
      productVariantsBulkUpdate: {
        __args: {
          productId,
          allowPartialUpdates,
          variants: [variantInput],
        },
        userErrors: { field: true, message: true },
        productVariants: variantSelection,
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    const updated = result.productVariantsBulkUpdate?.productVariants?.[0]
    printNode({ node: updated, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'variants delete') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'variant-id': { type: 'string' },
      },
    })

    const productId = requireProductIdForSubverb(args)
    const variantId = requireId((args as any)['variant-id'], 'ProductVariant', '--variant-id')

    const result = await runMutation(ctx, {
      productVariantsBulkDelete: {
        __args: { productId, variantsIds: [variantId] },
        product: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkDelete,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    const verify = await runQuery(ctx, {
      nodes: {
        __args: { ids: [variantId] },
        id: true,
      },
    })
    if (verify === undefined) return
    const stillThere = (verify.nodes?.[0] as any) !== null && (verify.nodes?.[0] as any) !== undefined
    const deletedVariantId = stillThere ? undefined : variantId

    if (ctx.quiet) return printIds([deletedVariantId])
    printJson({ productId, deletedVariantId }, ctx.format !== 'raw')
    return
  }

  if (verb === 'variants reorder') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'variant-id': { type: 'string' },
        position: { type: 'string' },
      },
    })

    const productId = requireProductIdForSubverb(args)
    const variantId = requireId((args as any)['variant-id'], 'ProductVariant', '--variant-id')
    const position = parseIntFlag('--position', (args as any).position)
    if (position <= 0) throw new CliError('--position must be a positive integer (1-based)', 2)

    const result = await runMutation(ctx, {
      productVariantsBulkReorder: {
        __args: { productId, positions: [{ id: variantId, position }] },
        product: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkReorder,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return printIds([variantId])
    printJson({ productId, variantId, position }, ctx.format !== 'raw')
    return
  }

  if (verb === 'by-handle') {
    const args = parseStandardArgs({ argv, extraOptions: { handle: { type: 'string' } } })
    const handle = args.handle as string | undefined
    if (!handle) throw new CliError('Missing --handle', 2)

    const selectValues = Array.isArray(args.select)
      ? args.select
      : args.select
        ? [args.select]
        : []
    const selectionOverride =
      typeof (args as any).selection === 'string' && (args as any).selection.length > 0
    const select =
      !selectionOverride && ctx.view !== 'raw' && ctx.view !== 'ids'
        ? Array.from(new Set([...selectValues, 'resourcePublicationsV2.nodes.publication.name']))
        : args.select

    const includeValues = Array.isArray(args.include)
      ? args.include
      : args.include
        ? [args.include]
        : []
    const include =
      ctx.view === 'all' ? Array.from(new Set([...includeValues, 'resourcePublicationsV2'])) : args.include

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelectionForGet(ctx.view) as any,
      select,
      selection: (args as any).selection,
      include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, { productByHandle: { __args: { handle }, ...selection } })
    if (result === undefined) return

    const wantsResourcePublicationsV2 =
      Array.isArray(args.select) &&
      args.select.some((p: unknown) => typeof p === 'string' && p.startsWith('resourcePublicationsV2'))
    const wantsResourcePublicationsV2ViaSelection =
      typeof (args as any).selection === 'string' && (args as any).selection.includes('resourcePublicationsV2')
    const stripResourcePublicationsV2 = !(wantsResourcePublicationsV2 || wantsResourcePublicationsV2ViaSelection)

    const withComputed = applyComputedFieldsToNode(result.productByHandle, {
      view: ctx.view,
      stripResourcePublicationsV2,
    })
    printNode({ node: withComputed, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'by-identifier') {
    const args = parseStandardArgs({ argv, extraOptions: { identifier: { type: 'string' } } })
    const identifier = parseJsonArg((args as any).identifier, '--identifier')

    const selectValues = Array.isArray(args.select)
      ? args.select
      : args.select
        ? [args.select]
        : []
    const selectionOverride =
      typeof (args as any).selection === 'string' && (args as any).selection.length > 0
    const select =
      !selectionOverride && ctx.view !== 'raw' && ctx.view !== 'ids'
        ? Array.from(new Set([...selectValues, 'resourcePublicationsV2.nodes.publication.name']))
        : args.select

    const includeValues = Array.isArray(args.include)
      ? args.include
      : args.include
        ? [args.include]
        : []
    const include =
      ctx.view === 'all' ? Array.from(new Set([...includeValues, 'resourcePublicationsV2'])) : args.include

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelectionForGet(ctx.view) as any,
      select,
      selection: (args as any).selection,
      include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, { productByIdentifier: { __args: { identifier }, ...selection } })
    if (result === undefined) return

    const wantsResourcePublicationsV2 =
      Array.isArray(args.select) &&
      args.select.some((p: unknown) => typeof p === 'string' && p.startsWith('resourcePublicationsV2'))
    const wantsResourcePublicationsV2ViaSelection =
      typeof (args as any).selection === 'string' && (args as any).selection.includes('resourcePublicationsV2')
    const stripResourcePublicationsV2 = !(wantsResourcePublicationsV2 || wantsResourcePublicationsV2ViaSelection)

    const withComputed = applyComputedFieldsToNode(result.productByIdentifier, {
      view: ctx.view,
      stripResourcePublicationsV2,
    })
    printNode({ node: withComputed, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'duplicate-job') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = args.id as any
    if (typeof id !== 'string' || !id) throw new CliError('Missing --id', 2)

    const selection = resolveSelection({
      typeName: 'ProductDuplicateJob',
      view: ctx.view,
      baseSelection: { id: true, done: true } as const,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { productDuplicateJob: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.productDuplicateJob, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'operation') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = args.id as any
    if (typeof id !== 'string' || !id) throw new CliError('Missing --id', 2)

    const getProductOperationSelection = (view: CommandContext['view']) => {
      if (view === 'raw') return {} as const
      if (view === 'ids') {
        return {
          __typename: true,
          on_ProductBundleOperation: { id: true },
          on_ProductDeleteOperation: { id: true },
          on_ProductDuplicateOperation: { id: true, newProduct: { id: true }, product: { id: true } },
          on_ProductSetOperation: { id: true, product: { id: true } },
        } as const
      }
      return {
        __typename: true,
        status: true,
        product: { id: true, title: true, handle: true, status: true },
        on_ProductBundleOperation: {
          id: true,
          status: true,
          product: { id: true, title: true },
          userErrors: { field: true, message: true },
        },
        on_ProductDeleteOperation: {
          id: true,
          status: true,
          product: { id: true, title: true },
          userErrors: { field: true, message: true },
        },
        on_ProductDuplicateOperation: {
          id: true,
          status: true,
          product: { id: true, title: true },
          newProduct: { id: true, title: true },
          userErrors: { field: true, message: true },
        },
        on_ProductSetOperation: {
          id: true,
          status: true,
          product: { id: true, title: true },
          userErrors: { code: true, field: true, message: true },
        },
      } as const
    }

    const selection = resolveSelection({
      typeName: 'ProductOperation',
      view: ctx.view,
      baseSelection: getProductOperationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { productOperation: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.productOperation, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'tags' || verb === 'types' || verb === 'vendors') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const field =
      verb === 'tags' ? 'productTags' : verb === 'types' ? 'productTypes' : 'productVendors'

    const result = await runQuery(ctx, {
      [field]: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: true,
      },
    } as any)
    if (result === undefined) return

    const connection = (result as any)[field]
    if (ctx.quiet) {
      for (const value of (connection?.nodes ?? []) as any[]) {
        if (typeof value === 'string' && value) process.stdout.write(`${value}\n`)
      }
      return
    }

    printConnection({
      connection,
      format: ctx.format,
      quiet: false,
      nextPageArgs: { base: `shop products ${verb}`, first, reverse: reverse === true },
    })
    return
  }

  if (verb === 'change-status') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const productId = requireProductIdForRootVerb(args)
    const status = args.status as string | undefined
    if (!status) throw new CliError('Missing --status (ACTIVE|DRAFT|ARCHIVED)', 2)

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      productChangeStatus: {
        __args: { productId, status: status as any },
        product: selection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productChangeStatus, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productChangeStatus?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'set') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        identifier: { type: 'string' },
        synchronous: { type: 'string' },
      },
    })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const identifier = (args as any).identifier ? parseJsonArg((args as any).identifier, '--identifier') : undefined
    const synchronousRaw = (args as any).synchronous as string | undefined
    const synchronous = (() => {
      if (synchronousRaw === undefined || synchronousRaw === null || synchronousRaw === '') return undefined
      const v = String(synchronousRaw).toLowerCase()
      if (v === 'true' || v === '1') return true
      if (v === 'false' || v === '0') return false
      throw new CliError('--synchronous must be true|false', 2)
    })()

    const result = await runMutation(ctx, {
      productSet: {
        __args: {
          input: built.input,
          ...(identifier !== undefined ? { identifier } : {}),
          ...(synchronous !== undefined ? { synchronous } : {}),
        },
        product: productSummarySelection,
        productSetOperation: {
          id: true,
          status: true,
          product: productSummarySelection,
          userErrors: { code: true, field: true, message: true },
        },
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productSet, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const pid = result.productSet?.product?.id
      const opId = result.productSet?.productSetOperation?.id
      return console.log(pid ?? opId ?? '')
    }
    printJson(result.productSet, ctx.format !== 'raw')
    return
  }

  if (verb === 'join-selling-plan-groups' || verb === 'leave-selling-plan-groups') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'product-id': { type: 'string' }, 'group-ids': { type: 'string', multiple: true } },
    })
    const id = requireProductIdForRootVerb(args)
    const sellingPlanGroupIds = parseIds((args as any)['group-ids'], 'SellingPlanGroup')

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const mutation = verb === 'join-selling-plan-groups'
      ? 'productJoinSellingPlanGroups'
      : 'productLeaveSellingPlanGroups'

    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { id, sellingPlanGroupIds },
        product: selection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: payload?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'options list') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const productId = requireProductIdForSubverb(args)

    const selection = resolveSelection({
      typeName: 'ProductOption',
      view: ctx.view,
      baseSelection: getProductOptionListSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      product: {
        __args: { id: productId },
        options: selection,
      },
    })
    if (result === undefined) return
    const options = (result.product?.options ?? []) as any[]
    printConnection({
      connection: { nodes: options, pageInfo: undefined },
      format: ctx.format,
      quiet: ctx.quiet,
    })
    return
  }

  if (verb === 'options create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        option: { type: 'string', multiple: true },
        'options-json': { type: 'string' },
        'variant-strategy': { type: 'string' },
      },
    })
    const productId = requireProductIdForSubverb(args)

    const optionSpecs = parseRepeatableStrings((args as any).option, '--option', { allowEmpty: true })
    const optionsJsonRaw = (args as any)['options-json'] as string | undefined
    if (optionSpecs.length > 0 && optionsJsonRaw) {
      throw new CliError('Do not pass both --option and --options-json', 2)
    }

    const options =
      optionsJsonRaw !== undefined
        ? parseJsonArg(optionsJsonRaw, '--options-json')
        : optionSpecs.map((s) => parseOptionSpec(s, '--option'))

    if (!Array.isArray(options) || options.length === 0) {
      throw new CliError('Missing options: pass one or more --option entries, or --options-json', 2)
    }

    const variantStrategy = normalizeProductOptionCreateVariantStrategy((args as any)['variant-strategy'])

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelectionForOptions(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      productOptionsCreate: {
        __args: { productId, options, ...(variantStrategy ? { variantStrategy } : {}) },
        product: selection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productOptionsCreate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productOptionsCreate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'options update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'option-id': { type: 'string' },
        name: { type: 'string' },
        position: { type: 'string' },
        'add-value': { type: 'string', multiple: true },
        'delete-value': { type: 'string', multiple: true },
        'rename-value': { type: 'string', multiple: true },
        'delete-value-id': { type: 'string', multiple: true },
        'rename-value-id': { type: 'string', multiple: true },
        'option-json': { type: 'string' },
        'add-values-json': { type: 'string' },
        'delete-value-ids-json': { type: 'string' },
        'update-values-json': { type: 'string' },
        'variant-strategy': { type: 'string' },
      },
    })
    const productId = requireProductIdForSubverb(args)
    const optionIdRaw = (args as any)['option-id'] as string | undefined
    if (!optionIdRaw) throw new CliError('Missing --option-id', 2)
    const optionId = coerceGid(optionIdRaw, 'ProductOption')

    const optionJsonRaw = (args as any)['option-json'] as string | undefined
    const addValuesJsonRaw = (args as any)['add-values-json'] as string | undefined
    const deleteValueIdsJsonRaw = (args as any)['delete-value-ids-json'] as string | undefined
    const updateValuesJsonRaw = (args as any)['update-values-json'] as string | undefined

    const hasJsonMode = Boolean(optionJsonRaw || addValuesJsonRaw || deleteValueIdsJsonRaw || updateValuesJsonRaw)

    const addValueNames = parseRepeatableStrings((args as any)['add-value'], '--add-value', { allowEmpty: true })
    const deleteValueNames = parseRepeatableStrings((args as any)['delete-value'], '--delete-value', { allowEmpty: true })
    const renameValueSpecs = parseRepeatableStrings((args as any)['rename-value'], '--rename-value', { allowEmpty: true })
    const deleteValueIdSpecs = parseRepeatableStrings((args as any)['delete-value-id'], '--delete-value-id', {
      allowEmpty: true,
    })
    const renameValueIdSpecs = parseRepeatableStrings((args as any)['rename-value-id'], '--rename-value-id', {
      allowEmpty: true,
    })

    if (hasJsonMode) {
      if (
        addValueNames.length ||
        deleteValueNames.length ||
        renameValueSpecs.length ||
        deleteValueIdSpecs.length ||
        renameValueIdSpecs.length ||
        args.name !== undefined ||
        (args as any).position !== undefined
      ) {
        throw new CliError('Do not mix JSON flags with non-JSON option update flags', 2)
      }
    }

    const position = parsePositiveIntFlag({ value: (args as any).position, flag: '--position' })
    const hasNonJsonOptionChange = (typeof args.name === 'string' && args.name.trim() !== '') || position !== undefined
    const hasNonJsonValueChange =
      addValueNames.length > 0 ||
      deleteValueNames.length > 0 ||
      renameValueSpecs.length > 0 ||
      deleteValueIdSpecs.length > 0 ||
      renameValueIdSpecs.length > 0

    if (!hasJsonMode && !hasNonJsonOptionChange && !hasNonJsonValueChange) {
      throw new CliError(
        'No changes specified. Pass --name/--position and/or value change flags (e.g. --add-value, --delete-value, --rename-value).',
        2,
      )
    }

    const optionUpdate =
      optionJsonRaw !== undefined
        ? parseJsonArg(optionJsonRaw, '--option-json')
        : {
            id: optionId,
            ...(typeof args.name === 'string' && args.name.trim() ? { name: args.name.trim() } : {}),
            ...(position !== undefined ? { position } : {}),
          }

    if (!optionUpdate || typeof optionUpdate !== 'object') {
      throw new CliError('--option-json must be a JSON object', 2)
    }

    if (!(optionUpdate as any).id) (optionUpdate as any).id = optionId

    const optionValuesToAdd =
      addValuesJsonRaw !== undefined
        ? parseJsonArg(addValuesJsonRaw, '--add-values-json')
        : addValueNames.map((name) => ({ name }))
    const optionValuesToDeleteJson =
      deleteValueIdsJsonRaw !== undefined ? parseJsonArg(deleteValueIdsJsonRaw, '--delete-value-ids-json') : undefined
    const optionValuesToUpdate =
      updateValuesJsonRaw !== undefined ? parseJsonArg(updateValuesJsonRaw, '--update-values-json') : undefined

    const optionValuesToDeleteFromIds = deleteValueIdSpecs.map((id) => coerceGid(id, 'ProductOptionValue'))

    const needsResolutionByName = deleteValueNames.length > 0 || renameValueSpecs.length > 0
    if (needsResolutionByName && ctx.dryRun) {
      throw new CliError(
        'Name-based value changes are not supported in --dry-run mode. Use --delete-value-id/--rename-value-id or JSON flags.',
        2,
      )
    }

    let resolvedDeletesFromNames: string[] = []
    let resolvedUpdatesFromNames: Array<{ id: string; name: string }> = []

    if (needsResolutionByName) {
      const options = await fetchProductOptionsForResolution({ ctx, productId })
      const option = options.find((o) => typeof o?.id === 'string' && o.id === optionId)
      if (!option) throw new CliError(`Option not found on product: ${optionId}`, 2)

      const optionValues = (option.optionValues ?? []) as any[]
      const byName = new Map<string, any[]>()
      for (const ov of optionValues) {
        const n = typeof ov?.name === 'string' ? ov.name : undefined
        if (!n) continue
        const list = byName.get(n) ?? []
        list.push(ov)
        byName.set(n, list)
      }

      for (const name of deleteValueNames) {
        const matches = byName.get(name) ?? []
        if (matches.length === 0) throw new CliError(`Option value not found: "${name}"`, 2)
        if (matches.length > 1) {
          throw new CliError(`Multiple option values named "${name}" exist. Use --delete-value-id instead.`, 2)
        }
        const id = matches[0]?.id
        if (typeof id !== 'string' || !id) throw new CliError(`Option value "${name}" is missing an ID`, 2)
        resolvedDeletesFromNames.push(id)
      }

      for (const spec of renameValueSpecs) {
        const { from, to } = parseFromTo(spec, '--rename-value')
        const matches = byName.get(from) ?? []
        if (matches.length === 0) throw new CliError(`Option value not found: "${from}"`, 2)
        if (matches.length > 1) {
          throw new CliError(`Multiple option values named "${from}" exist. Use --rename-value-id instead.`, 2)
        }
        const id = matches[0]?.id
        if (typeof id !== 'string' || !id) throw new CliError(`Option value "${from}" is missing an ID`, 2)
        resolvedUpdatesFromNames.push({ id, name: to })
      }
    }

    const renameUpdatesFromIds: Array<{ id: string; name: string }> = []
    for (const spec of renameValueIdSpecs) {
      const { from, to } = parseFromTo(spec, '--rename-value-id')
      renameUpdatesFromIds.push({ id: coerceGid(from, 'ProductOptionValue'), name: to })
    }

    const deletesFromJson =
      optionValuesToDeleteJson !== undefined
        ? (() => {
            if (!Array.isArray(optionValuesToDeleteJson)) {
              throw new CliError('--delete-value-ids-json must be a JSON array', 2)
            }
            return optionValuesToDeleteJson.map((id) => {
              if (typeof id !== 'string' || !id.trim()) throw new CliError('delete-value-ids-json must contain strings', 2)
              return id
            })
          })()
        : []

    const deletes = Array.from(new Set([...optionValuesToDeleteFromIds, ...resolvedDeletesFromNames, ...deletesFromJson]))

    const updates = [
      ...(Array.isArray(optionValuesToUpdate) ? optionValuesToUpdate : optionValuesToUpdate ? [optionValuesToUpdate] : []),
      ...resolvedUpdatesFromNames,
      ...renameUpdatesFromIds,
    ]

    if (optionValuesToAdd !== undefined && optionValuesToAdd !== null && !Array.isArray(optionValuesToAdd)) {
      throw new CliError('--add-values-json must be a JSON array', 2)
    }

    if (optionValuesToUpdate !== undefined && optionValuesToUpdate !== null && !Array.isArray(optionValuesToUpdate)) {
      throw new CliError('--update-values-json must be a JSON array', 2)
    }

    const variantStrategy = normalizeProductOptionUpdateVariantStrategy((args as any)['variant-strategy'])

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelectionForOptions(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      productOptionUpdate: {
        __args: {
          productId,
          option: optionUpdate,
          ...(Array.isArray(optionValuesToAdd) && optionValuesToAdd.length ? { optionValuesToAdd } : {}),
          ...(deletes.length ? { optionValuesToDelete: deletes } : {}),
          ...(updates.length ? { optionValuesToUpdate: updates } : {}),
          ...(variantStrategy ? { variantStrategy } : {}),
        },
        product: selection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productOptionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productOptionUpdate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'options delete') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'option-id': { type: 'string', multiple: true },
        'option-name': { type: 'string', multiple: true },
        strategy: { type: 'string' },
      },
    })
    const productId = requireProductIdForSubverb(args)
    const optionIdsRaw = parseStringList((args as any)['option-id'], '--option-id', { allowEmpty: true })
    const optionNames = parseStringList((args as any)['option-name'], '--option-name', { allowEmpty: true })
    const strategy = normalizeProductOptionDeleteStrategy(args.strategy)

    if (optionIdsRaw.length === 0 && optionNames.length === 0) {
      throw new CliError('Missing options: pass one or more --option-id and/or --option-name entries', 2)
    }

    if (ctx.dryRun && optionNames.length > 0) {
      throw new CliError('Option name resolution is not supported in --dry-run mode. Use --option-id instead.', 2)
    }

    const optionIds = optionIdsRaw.map((id) => coerceGid(id, 'ProductOption'))

    if (optionNames.length > 0) {
      const options = await fetchProductOptionsForResolution({ ctx, productId })
      for (const name of optionNames) {
        const opt = resolveSingleOptionByName(options, name)
        if (!opt) throw new CliError(`Option not found on product: "${name}"`, 2)
        const id = opt?.id
        if (typeof id !== 'string' || !id) throw new CliError(`Option "${name}" is missing an ID`, 2)
        optionIds.push(id)
      }
    }

    const uniqueOptionIds = Array.from(new Set(optionIds))

    const result = await runMutation(ctx, {
      productOptionsDelete: {
        __args: { productId, options: uniqueOptionIds, ...(strategy ? { strategy } : {}) },
        deletedOptionsIds: true,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productOptionsDelete, failOnUserErrors: ctx.failOnUserErrors })
    const deleted = (result.productOptionsDelete?.deletedOptionsIds ?? []) as Array<string | undefined | null>
    if (ctx.quiet) {
      for (const id of deleted) {
        if (typeof id === 'string' && id) console.log(id)
      }
      return
    }
    printNode({
      node: { deletedOptionsIds: deleted.filter((id): id is string => typeof id === 'string' && id.length > 0) },
      format: ctx.format,
      quiet: false,
    })
    return
  }

  if (verb === 'options reorder') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        order: { type: 'string', multiple: true },
        'options-json': { type: 'string' },
      },
    })
    const productId = requireProductIdForSubverb(args)

    const orderSpecs = parseRepeatableStrings((args as any).order, '--order', { allowEmpty: true })
    const optionsJsonRaw = (args as any)['options-json'] as string | undefined
    if (orderSpecs.length > 0 && optionsJsonRaw) {
      throw new CliError('Do not pass both --order and --options-json', 2)
    }

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelectionForOptions(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const optionsInput = optionsJsonRaw !== undefined ? parseJsonArg(optionsJsonRaw, '--options-json') : undefined

    let options: any[] = []
    if (optionsInput !== undefined) {
      if (!Array.isArray(optionsInput)) throw new CliError('--options-json must be a JSON array', 2)
      options = optionsInput
    } else {
      if (orderSpecs.length === 0) throw new CliError('Missing order: pass one or more --order entries, or --options-json', 2)

      const parsed: any[] = []
      const hasAnyValueOrder = orderSpecs.some((s) => s.includes('='))
      if (hasAnyValueOrder && ctx.dryRun) {
        throw new CliError('Value reordering via --order is not supported in --dry-run mode. Use --options-json.', 2)
      }

      let optionsForValidation: any[] | undefined
      if (hasAnyValueOrder) {
        optionsForValidation = await fetchProductOptionsForResolution({ ctx, productId })
      }

      for (const spec of orderSpecs) {
        const trimmed = spec.trim()
        const eq = trimmed.indexOf('=')
        const optionToken = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim()
        if (!optionToken) throw new CliError('--order cannot be empty', 2)

        const optionInput: any = looksLikeGidOrNumericId(optionToken)
          ? { id: coerceGid(optionToken, 'ProductOption') }
          : { name: optionToken }

        if (eq !== -1) {
          const valuesPart = trimmed.slice(eq + 1).trim()
          if (!valuesPart) throw new CliError(`--order "${spec}" must include at least one value after '='`, 2)
          const valueTokens = valuesPart
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
          if (valueTokens.length === 0) throw new CliError(`--order "${spec}" must include at least one value after '='`, 2)

          if (!optionsForValidation) throw new CliError('Internal error: missing options for validation', 2)

          const resolvedOption =
            'id' in optionInput
              ? optionsForValidation.find((o) => typeof o?.id === 'string' && o.id === optionInput.id)
              : resolveSingleOptionByName(optionsForValidation, optionInput.name)
          if (!resolvedOption) {
            const ref = 'id' in optionInput ? optionInput.id : `"${optionInput.name}"`
            throw new CliError(`Option not found on product: ${ref}`, 2)
          }

          const optionValues = (resolvedOption.optionValues ?? []) as any[]
          const byName = new Map<string, any[]>()
          const existingIds: string[] = []
          for (const ov of optionValues) {
            const id = typeof ov?.id === 'string' ? ov.id : undefined
            const name = typeof ov?.name === 'string' ? ov.name : undefined
            if (id) existingIds.push(id)
            if (name) {
              const list = byName.get(name) ?? []
              list.push(ov)
              byName.set(name, list)
            }
          }

          const providedIds: string[] = []
          for (const vt of valueTokens) {
            if (looksLikeGidOrNumericId(vt)) {
              providedIds.push(coerceGid(vt, 'ProductOptionValue'))
              continue
            }
            const matches = byName.get(vt) ?? []
            if (matches.length === 0) throw new CliError(`Option value not found: "${vt}"`, 2)
            if (matches.length > 1) throw new CliError(`Multiple option values named "${vt}" exist. Use IDs.`, 2)
            const id = matches[0]?.id
            if (typeof id !== 'string' || !id) throw new CliError(`Option value "${vt}" is missing an ID`, 2)
            providedIds.push(id)
          }

          const existingSet = new Set(existingIds)
          const providedSet = new Set(providedIds)
          if (providedSet.size !== providedIds.length) {
            throw new CliError('Duplicate option values provided in --order value list', 2)
          }
          const missing = existingIds.filter((id) => !providedSet.has(id))
          const extra = providedIds.filter((id) => !existingSet.has(id))
          if (missing.length || extra.length) {
            throw new CliError(
              `--order "${optionToken}=..." must include the full value order for that option.`,
              2,
            )
          }

          parsed.push({
            id: resolvedOption.id,
            values: providedIds.map((id) => ({ id })),
          })
        } else {
          parsed.push(optionInput)
        }
      }

      options = parsed
    }

    const result = await runMutation(ctx, {
      productOptionsReorder: {
        __args: { productId, options },
        product: selection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productOptionsReorder, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productOptionsReorder?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'combined-listing-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'parent-product-id': { type: 'string' },
        title: { type: 'string' },
        'products-added': { type: 'string' },
        'products-edited': { type: 'string' },
        'products-removed-ids': { type: 'string', multiple: true },
        'options-and-values': { type: 'string' },
      },
    })
    const parentProductId = requireId((args as any)['parent-product-id'], 'Product', '--parent-product-id')

    const optionsAndValues = (args as any)['options-and-values']
      ? parseJsonArg((args as any)['options-and-values'], '--options-and-values')
      : undefined
    const productsAdded = (args as any)['products-added']
      ? parseJsonArg((args as any)['products-added'], '--products-added')
      : undefined
    const productsEdited = (args as any)['products-edited']
      ? parseJsonArg((args as any)['products-edited'], '--products-edited')
      : undefined
    const productsRemovedIds = (args as any)['products-removed-ids']
      ? parseIds((args as any)['products-removed-ids'], 'Product')
      : undefined
    const title = args.title as string | undefined

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      combinedListingUpdate: {
        __args: {
          parentProductId,
          ...(title ? { title } : {}),
          ...(optionsAndValues !== undefined ? { optionsAndValues } : {}),
          ...(productsAdded !== undefined ? { productsAdded } : {}),
          ...(productsEdited !== undefined ? { productsEdited } : {}),
          ...(productsRemovedIds !== undefined ? { productsRemovedIds } : {}),
        },
        product: selection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.combinedListingUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.combinedListingUpdate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'bundle-create' || verb === 'bundle-update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const productSelection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const mutation = verb === 'bundle-create' ? 'productBundleCreate' : 'productBundleUpdate'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { input: built.input },
        productBundleOperation: {
          id: true,
          status: true,
          product: productSelection,
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })

    const operation = payload?.productBundleOperation
      ? {
          id: payload.productBundleOperation.id,
          status: payload.productBundleOperation.status,
        }
      : undefined

    const product = payload?.productBundleOperation?.product
    if (product && typeof product === 'object') {
      printNode({
        node: { ...product, ...(operation ? { operation } : {}) },
        format: ctx.format,
        quiet: ctx.quiet,
      })
      return
    }

    if (ctx.quiet) return
    printJson(
      {
        product: product ?? null,
        ...(operation ? { operation } : {}),
        userErrors: payload?.userErrors ?? [],
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        limit: { type: 'string' },
        'saved-search-id': { type: 'string' },
      },
    })
    const query = args.query as any
    const limitRaw = args.limit as any
    const savedSearchIdRaw = (args as any)['saved-search-id'] as any

    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const savedSearchId = savedSearchIdRaw
      ? coerceGid(String(savedSearchIdRaw), 'SavedSearch')
      : undefined

    const result = await runQuery(ctx, {
      productsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(savedSearchId ? { savedSearchId } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.productsCount?.count ?? '')
    printJson(result.productsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'publish' || verb === 'unpublish') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'publication-id': { type: 'string', multiple: true },
        publication: { type: 'string', multiple: true },
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })
    const id = requireProductIdForRootVerb(args)

    const publicationIds = ((args['publication-id'] as any) ?? []) as string[]
    const publicationNames = ((args.publication as any) ?? []) as string[]

    const resolvedPublicationIds = await resolvePublicationIds({
      ctx,
      publicationIds,
      publicationNames,
    })

    if (verb === 'publish') {
      const publishDate = parsePublishDate({ at: args.at as any, now: args.now as any })
      const payload = await publishProduct({
        ctx,
        id,
        publicationIds: resolvedPublicationIds,
        publishDate,
      })
      if (payload === undefined) return
      if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
      printJson(payload)
      return
    }

    const payload = await unpublishProduct({
      ctx,
      id,
      publicationIds: resolvedPublicationIds,
    })
    if (payload === undefined) return
    if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
    printJson(payload)
    return
  }

  if (verb === 'publish-all') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })

    if (ctx.dryRun) {
      await listPublications(ctx)
      return
    }

    const id = requireProductIdForRootVerb(args)
    const publishDate = parsePublishDate({ at: args.at as any, now: args.now as any })
    const publications = await listPublications(ctx)
    const publicationIds = publications.map((p) => p.id).filter(Boolean)
    if (publicationIds.length === 0) throw new CliError('No publications found to publish to', 2)

    const payload = await publishProduct({
      ctx,
      id,
      publicationIds,
      publishDate,
    })
    if (payload === undefined) return
    if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
    printJson(payload)
    return
  }

  if (verb === 'metafields upsert') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const productId = requireProductIdForSubverb(args)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await metafieldsUpsert({ ctx, id: productId, input: built.input })
    if (result === undefined) return

    printJson(result)
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)

    const selectValues = Array.isArray(args.select)
      ? args.select
      : args.select
        ? [args.select]
        : []
    const selectionOverride =
      typeof (args as any).selection === 'string' && (args as any).selection.length > 0
    const select =
      !selectionOverride && ctx.view !== 'raw' && ctx.view !== 'ids'
        ? Array.from(new Set([...selectValues, 'resourcePublicationsV2.nodes.publication.name']))
        : args.select

    const includeValues = Array.isArray(args.include)
      ? args.include
      : args.include
        ? [args.include]
        : []
    const include =
      ctx.view === 'all' ? Array.from(new Set([...includeValues, 'resourcePublicationsV2'])) : args.include

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelectionForGet(ctx.view) as any,
      select,
      selection: (args as any).selection,
      include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, { product: { __args: { id }, ...selection } })
    if (result === undefined) return
    const wantsResourcePublicationsV2 =
      Array.isArray(args.select) &&
      args.select.some((p: unknown) => typeof p === 'string' && p.startsWith('resourcePublicationsV2'))
    const wantsResourcePublicationsV2ViaSelection =
      typeof (args as any).selection === 'string' && (args as any).selection.includes('resourcePublicationsV2')
    const stripResourcePublicationsV2 = !(wantsResourcePublicationsV2 || wantsResourcePublicationsV2ViaSelection)

    const withComputed = applyComputedFieldsToNode(result.product, {
      view: ctx.view,
      stripResourcePublicationsV2,
    })
    printNode({ node: withComputed, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        published: { type: 'boolean' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const userQuery =
      typeof args.query === 'string' && args.query.trim() ? (args.query.trim() as any) : undefined
    const published = args.published === true
    const publishedFilter = 'published_status:published'
    const query =
      published && typeof userQuery === 'string' && userQuery.includes(publishedFilter)
        ? userQuery
        : published
          ? (userQuery ? `${userQuery} ${publishedFilter}` : publishedFilter)
          : userQuery
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      products: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.products,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'products',
        { first, query: userQuery, sort: sortKey, reverse },
        published ? [{ flag: '--published', value: true }] : undefined,
      ),
    })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runMutation(ctx, {
      productCreate: {
        __args: { input: normalizeProductInput(built.input) },
        product: selection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productCreate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productCreate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'archive' || verb === 'unarchive') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)
    const status =
      verb === 'archive' ? 'ARCHIVED' : ((args.status as string | undefined) ?? 'DRAFT')

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { input: { id, status } },
        product: selection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productUpdate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = normalizeProductInput({ ...built.input, id })

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { input },
        product: selection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productUpdate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      productDelete: {
        __args: { input: { id } },
        deletedProductId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productDelete?.deletedProductId ?? '')
    printJson(result.productDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)

    const built = buildInput({
      inputArg: undefined,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    let newTitle =
      (args['new-title'] as string | undefined) ??
      (built.used ? built.input?.newTitle : undefined)

    if (!newTitle) {
      const original = await runQuery(ctx, { product: { __args: { id }, title: true } })
      if (original === undefined) return
      const title = original.product?.title
      if (!title) throw new CliError('Could not resolve original product title to auto-generate newTitle', 2)
      newTitle = `${title} (Copy)`
    }

    const mutationArgs = {
      productId: id,
      newTitle,
      ...(built.used ? built.input : {}),
    }

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runMutation(ctx, {
      productDuplicate: {
        __args: mutationArgs,
        newProduct: selection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productDuplicate?.newProduct, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'set-status') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)
    const status = args.status as string | undefined
    if (!status) throw new CliError('Missing --status (ACTIVE|DRAFT|ARCHIVED)', 2)

    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { input: { id, status } },
        product: selection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productUpdate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'set-price') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'variant-id': { type: 'string' },
        price: { type: 'string' },
        'compare-at-price': { type: 'string' },
        'product-id': { type: 'string' },
      },
    })

    const variantId = requireId((args as any)['variant-id'], 'ProductVariant', '--variant-id')
    const price = args.price as string | undefined
    if (!price) throw new CliError('Missing --price', 2)

    const compareAtPrice = (args as any)['compare-at-price'] as string | undefined
    const explicitProductId = (args as any)['product-id'] as string | undefined

    let productId: string
    if (explicitProductId) {
      productId = coerceGid(explicitProductId, 'Product')
    } else {
      if (ctx.dryRun) {
        throw new CliError(
          'In --dry-run mode, --product-id is required because resolving a productId from a variantId requires executing a query.',
          2,
        )
      }
      const resolved = await runQuery(ctx, {
        productVariant: { __args: { id: variantId }, product: { id: true } },
      })
      if (resolved === undefined) return
      const pid = resolved.productVariant?.product?.id
      if (!pid) throw new CliError('Could not resolve productId from --variant-id', 2)
      productId = pid
    }

    const variantSelection = resolveSelection({
      typeName: 'ProductVariant',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runMutation(ctx, {
      productVariantsBulkUpdate: {
        __args: {
          productId,
          variants: [
            {
              id: variantId,
              price,
              ...(compareAtPrice ? { compareAtPrice } : {}),
            },
          ],
        },
        userErrors: { field: true, message: true },
        productVariants: variantSelection,
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    const variant = result.productVariantsBulkUpdate?.productVariants?.[0]
    printNode({ node: variant, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'add-tags' || verb === 'remove-tags') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForRootVerb(args)
    const tags = parseTags(args.tags as any)

    const mutationField = verb === 'add-tags' ? 'tagsAdd' : 'tagsRemove'
    const nodeSelection = resolveSelection({
      typeName: 'Product',
      view: ctx.view,
      baseSelection: getProductSelectionForTags(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })
    const request: any = {
      [mutationField]: {
        __args: { id, tags },
        node: { __typename: true, on_Product: nodeSelection },
        userErrors: { field: true, message: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: payload?.node, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'media add') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        url: { type: 'string', multiple: true },
        alt: { type: 'string' },
        'media-type': { type: 'string' },
        'media-content-type': { type: 'string' },
        wait: { type: 'boolean' },
        'poll-interval-ms': { type: 'string' },
        'timeout-ms': { type: 'string' },
      },
    })
    const productId = requireProductIdForSubverb(args)

    const urls = (args.url as string[] | undefined) ?? []
    if (urls.length === 0) throw new CliError('Missing --url (repeatable)', 2)

    const mediaContentTypeRaw = (args as any)['media-content-type'] as string | undefined
    const mediaTypeRaw = (args as any)['media-type'] as string | undefined
    if (mediaContentTypeRaw && mediaTypeRaw) {
      const a = mediaContentTypeRaw.trim().toUpperCase()
      const b = mediaTypeRaw.trim().toUpperCase()
      if (a && b && a !== b) {
        throw new CliError('Do not pass both --media-content-type and --media-type with different values', 2)
      }
    }

    const mediaContentType = normalizeMediaContentType(mediaContentTypeRaw ?? mediaTypeRaw)
    const alt = args.alt as string | undefined
    const wait = (args as any).wait === true
    const pollIntervalMs =
      parsePositiveIntFlag({ value: (args as any)['poll-interval-ms'], flag: '--poll-interval-ms' }) ?? 1000
    const timeoutMs =
      parsePositiveIntFlag({ value: (args as any)['timeout-ms'], flag: '--timeout-ms' }) ?? 10 * 60 * 1000
    const shouldWait = wait && !ctx.dryRun
    const beforeIds = shouldWait ? await getTopProductMediaIds({ ctx, productId }) : []

    const media = urls.map((url) => ({
      originalSource: url,
      mediaContentType,
      ...(alt ? { alt } : {}),
    }))

    const viewForSelection = ctx.view === 'all' ? 'full' : ctx.view
    const nodeSelection = resolveSelection({
      typeName: 'Media',
      view: viewForSelection,
      baseSelection: getProductMediaSelection(viewForSelection) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: 10,
    })

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { product: { id: productId }, media },
        product: {
          id: true,
          media: {
            __args: { last: media.length, sortKey: 'POSITION' as any },
            nodes: nodeSelection,
          },
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (!shouldWait) {
      const connection = result.productUpdate?.product?.media ?? { nodes: [], pageInfo: undefined }
      printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
      return
    }

    const afterIds = await getTopProductMediaIds({ ctx, productId })
    const before = new Set(beforeIds)
    const createdIds = afterIds.filter((mid) => !before.has(mid)).slice(0, urls.length)
    if (createdIds.length !== urls.length) {
      throw new CliError(
        `Unable to determine created media IDs for waiting (expected ${urls.length}, got ${createdIds.length}).`,
        2,
      )
    }

    const final = await waitForFilesReadyOrFailed({ ctx, ids: createdIds, pollIntervalMs, timeoutMs })
    if (ctx.quiet) {
      for (const mid of createdIds) console.log(mid)
    } else {
      printConnection({
        connection: { nodes: final.nodes, pageInfo: undefined },
        format: ctx.format,
        quiet: false,
      })
    }
    if (final.failedIds.length > 0) {
      throw new CliError(`One or more media files failed processing: ${final.failedIds.join(', ')}`, 2)
    }
    return
  }

  if (verb === 'media upload') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        file: { type: 'string', multiple: true },
        filename: { type: 'string' },
        alt: { type: 'string' },
        'content-type': { type: 'string' },
        'mime-type': { type: 'string' },
        'media-type': { type: 'string' },
        'media-content-type': { type: 'string' },
        wait: { type: 'boolean' },
        'poll-interval-ms': { type: 'string' },
        'timeout-ms': { type: 'string' },
      },
    })
    const id = requireProductIdForSubverb(args)

    const filePaths = (args.file as string[] | undefined) ?? []
    if (filePaths.length === 0) throw new CliError('Missing --file (repeatable)', 2)

    const usesStdin = filePaths.includes('-')
    if (usesStdin && filePaths.length !== 1) {
      throw new CliError('When using --file -, provide exactly one --file', 2)
    }

    let cleanupStdin: (() => Promise<void>) | undefined
    try {
      let effectiveFilePaths = filePaths
      if (usesStdin) {
        const stdinFile = await writeStdinToTempFile({ filename: (args as any).filename ?? '' })
        cleanupStdin = stdinFile.cleanup
        effectiveFilePaths = [stdinFile.filePath]
      }

      const mediaContentTypeRaw = (args as any)['media-content-type'] as string | undefined
      const mediaTypeRaw = (args as any)['media-type'] as string | undefined
      if (mediaContentTypeRaw && mediaTypeRaw) {
        const a = mediaContentTypeRaw.trim().toUpperCase()
        const b = mediaTypeRaw.trim().toUpperCase()
        if (a && b && a !== b) {
          throw new CliError('Do not pass both --media-content-type and --media-type with different values', 2)
        }
      }
      const forcedMediaType = mediaContentTypeRaw ?? mediaTypeRaw
      const forced = forcedMediaType ? normalizeMediaContentType(forcedMediaType) : undefined
      const resourceOverride = forced ? mediaTypeToStagedResource(forced) : undefined

      const mimeTypeRaw = (args as any)['mime-type'] as string | undefined
      const contentTypeRaw = (args as any)['content-type'] as string | undefined
      if (mimeTypeRaw && contentTypeRaw) {
        const a = mimeTypeRaw.trim()
        const b = contentTypeRaw.trim()
        if (a && b && a !== b) {
          throw new CliError('Do not pass both --mime-type and --content-type with different values', 2)
        }
      }
      const mimeType = mimeTypeRaw ?? contentTypeRaw

      const wait = (args as any).wait === true
      const pollIntervalMs =
        parsePositiveIntFlag({ value: (args as any)['poll-interval-ms'], flag: '--poll-interval-ms' }) ?? 1000
      const timeoutMs =
        parsePositiveIntFlag({ value: (args as any)['timeout-ms'], flag: '--timeout-ms' }) ?? 10 * 60 * 1000
      const shouldWait = wait && !ctx.dryRun
      const beforeIds = shouldWait ? await getTopProductMediaIds({ ctx, productId: id }) : []

      const localFiles = await buildLocalFilesForStagedUpload({
        filePaths: effectiveFilePaths,
        mimeType: mimeType as any,
        resource: resourceOverride,
      })

      const targets = await stagedUploadLocalFiles(ctx, localFiles)
      if (targets === undefined) return

      const alt = args.alt as string | undefined
      const media = targets.map((t, i) => {
        const local = localFiles[i]!
        if (!t.resourceUrl) throw new CliError(`Missing staged target resourceUrl for ${local.filename}`, 2)
        return {
          originalSource: t.resourceUrl,
          mediaContentType: forced ?? stagedResourceToMediaType(local.resource),
          ...(alt ? { alt } : {}),
        }
      })

      const viewForSelection = ctx.view === 'all' ? 'full' : ctx.view
      const nodeSelection = resolveSelection({
        typeName: 'Media',
        view: viewForSelection,
        baseSelection: getProductMediaSelection(viewForSelection) as any,
        select: args.select,
        selection: (args as any).selection,
        include: args.include,
        ensureId: ctx.quiet,
        defaultConnectionFirst: 10,
      })

      const result = await runMutation(ctx, {
        productUpdate: {
          __args: { product: { id }, media },
          product: {
            id: true,
            media: {
              __args: { last: media.length, sortKey: 'POSITION' as any },
              nodes: nodeSelection,
            },
          },
          userErrors: { field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })

      const connection = result.productUpdate?.product?.media ?? { nodes: [], pageInfo: undefined }
      if (!shouldWait) {
        printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
        return
      }

      const afterIds = await getTopProductMediaIds({ ctx, productId: id })
      const before = new Set(beforeIds)
      const expectedCount = localFiles.length
      const createdIds = afterIds.filter((mid) => !before.has(mid)).slice(0, expectedCount)
      if (createdIds.length !== expectedCount) {
        throw new CliError(
          `Unable to determine created media IDs for waiting (expected ${expectedCount}, got ${createdIds.length}).`,
          2,
        )
      }

      const final = await waitForFilesReadyOrFailed({ ctx, ids: createdIds, pollIntervalMs, timeoutMs })
      if (ctx.quiet) {
        for (const mid of createdIds) console.log(mid)
      } else {
        printConnection({
          connection: { nodes: final.nodes, pageInfo: undefined },
          format: ctx.format,
          quiet: false,
        })
      }
      if (final.failedIds.length > 0) {
        throw new CliError(`One or more media files failed processing: ${final.failedIds.join(', ')}`, 2)
      }
      return
    } finally {
      if (cleanupStdin) await cleanupStdin()
    }
  }

  if (verb === 'media list') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const id = requireProductIdForSubverb(args)
    const first = parseFirst(args.first)
    const after = args.after as any

    const result = await runQuery(ctx, {
      product: {
        __args: { id },
        media: {
          __args: { first, after },
          pageInfo: { hasNextPage: true, endCursor: true },
          nodes: productMediaSelection,
        },
      },
    })
    if (result === undefined) return
    const connection = result.product?.media ?? { nodes: [], pageInfo: undefined }
    printConnection({
      connection,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop products media list',
        first,
        extraFlags: [{ flag: '--product-id', value: id }],
      },
    })
    return
  }

  if (verb === 'media remove') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'media-id': { type: 'string', multiple: true },
      },
    })
    const productId = requireProductIdForSubverb(args)
    const mediaIds = ((args as any)['media-id'] as string[] | undefined) ?? []
    if (mediaIds.length === 0) throw new CliError('Missing --media-id (repeatable)', 2)

    const files = mediaIds.map((id) => ({
      id: normalizeMediaId(id, '--media-id'),
      referencesToRemove: [productId],
    }))

    const result = await runMutation(ctx, {
      fileUpdate: {
        __args: { files },
        files: { id: true, alt: true, fileStatus: true, updatedAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileUpdate, failOnUserErrors: ctx.failOnUserErrors })

    const removedMediaIds = ((result.fileUpdate?.files ?? []) as any[])
      .map((f) => (typeof f?.id === 'string' ? (f.id as string) : undefined))
      .filter((id): id is string => typeof id === 'string' && id.trim() !== '')

    if (ctx.quiet) return printIds(removedMediaIds)

    printJson(
      {
        productId,
        removedMediaIds,
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'media update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'media-id': { type: 'string' },
        alt: { type: 'string' },
      },
    })
    const mediaIdRaw = (args as any)['media-id'] as string | undefined
    if (!mediaIdRaw) throw new CliError('Missing --media-id', 2)
    const alt = args.alt as string | undefined
    if (alt === undefined) throw new CliError('Missing --alt', 2)

    const files = [{ id: normalizeMediaId(mediaIdRaw, '--media-id'), alt }]

    const result = await runMutation(ctx, {
      fileUpdate: {
        __args: { files },
        files: { id: true, alt: true, fileStatus: true, updatedAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(files[0]!.id)
    printJson(result.fileUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'media reorder') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        moves: { type: 'string' },
        move: { type: 'string', multiple: true },
      },
    })
    const id = requireProductIdForSubverb(args)

    let moves: Array<{ id: string; newPosition: string }> = []
    if ((args as any).moves) {
      try {
        const parsed = parseJson5((args as any).moves as string)
        if (!Array.isArray(parsed)) throw new CliError('--moves must be a JSON array', 2)
        moves = parsed as any
      } catch (err) {
        throw new CliError(`--moves must be valid JSON: ${(err as Error).message}`, 2)
      }
    } else if ((args as any).move) {
      const raw = (args as any).move as string[]
      const parsedMoves: Array<{ id: string; newPosition: string }> = []
      for (const item of raw) {
        const idx = item.lastIndexOf(':')
        if (idx <= 0 || idx === item.length - 1) throw new CliError('--move must be <mediaId>:<newPosition>', 2)
        const mediaId = item.slice(0, idx).trim()
        const pos = Number(item.slice(idx + 1).trim())
        if (!mediaId) throw new CliError('--move mediaId cannot be empty', 2)
        if (!Number.isFinite(pos) || pos < 0) throw new CliError('--move newPosition must be a non-negative number', 2)
        parsedMoves.push({ id: normalizeMediaId(mediaId, '--move mediaId'), newPosition: String(Math.floor(pos)) })
      }
      moves = parsedMoves as any
    }

    if (moves.length === 0) {
      throw new CliError('Missing moves: pass either --moves <json> or --move <mediaId>:<newPosition> (repeatable)', 2)
    }

    const normalizedMoves = moves.map((move, i) => {
      const id = (move as any)?.id
      const newPosition = (move as any)?.newPosition
      if (typeof id !== 'string' || !id.trim()) {
        throw new CliError(`moves[${i}].id is required`, 2)
      }
      const pos = Number(newPosition)
      if (!Number.isFinite(pos) || pos < 0) {
        throw new CliError(`moves[${i}].newPosition must be a non-negative number`, 2)
      }
      return { id: normalizeMediaId(id, `moves[${i}].id`), newPosition: String(Math.floor(pos)) }
    })

    const result = await runMutation(ctx, {
      productReorderMedia: {
        __args: { id, moves: normalizedMoves },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productReorderMedia, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productReorderMedia?.job?.id ?? '')
    printJson(result.productReorderMedia, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for products: ${verb}`, 2)
}
