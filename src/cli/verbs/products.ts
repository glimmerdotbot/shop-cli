import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
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

import { buildListNextPageArgs, parseFirst, parseIds, parseJsonArg, parseStringList, requireId } from './_shared'

type MediaContentType = 'IMAGE' | 'VIDEO' | 'MODEL_3D' | 'EXTERNAL_VIDEO'

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

const normalizeMediaId = (value: string) => {
  const raw = value.trim()
  if (!raw) throw new CliError('Media ID cannot be empty', 2)
  if (raw.startsWith('gid://')) return raw
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

export const runProducts = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
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
        '  option-update|options-create|options-delete|options-reorder',
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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const productId = requireId(args.id, 'Product')
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
    const args = parseStandardArgs({ argv, extraOptions: { 'group-ids': { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'Product')
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

  if (verb === 'option-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        option: { type: 'string' },
        'option-values-to-add': { type: 'string' },
        'option-values-to-delete': { type: 'string' },
        'option-values-to-update': { type: 'string' },
        'variant-strategy': { type: 'string' },
      },
    })
    const productId = requireId((args as any)['product-id'], 'Product')
    const option = parseJsonArg((args as any).option, '--option')

    const optionValuesToAdd = (args as any)['option-values-to-add']
      ? parseJsonArg((args as any)['option-values-to-add'], '--option-values-to-add')
      : undefined
    const optionValuesToDelete = (args as any)['option-values-to-delete']
      ? parseJsonArg((args as any)['option-values-to-delete'], '--option-values-to-delete')
      : undefined
    const optionValuesToUpdate = (args as any)['option-values-to-update']
      ? parseJsonArg((args as any)['option-values-to-update'], '--option-values-to-update')
      : undefined
    const variantStrategy = (args as any)['variant-strategy'] as string | undefined

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
          option,
          ...(optionValuesToAdd !== undefined ? { optionValuesToAdd } : {}),
          ...(optionValuesToDelete !== undefined ? { optionValuesToDelete } : {}),
          ...(optionValuesToUpdate !== undefined ? { optionValuesToUpdate } : {}),
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

  if (verb === 'options-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        options: { type: 'string' },
        'variant-strategy': { type: 'string' },
      },
    })
    const productId = requireId((args as any)['product-id'], 'Product')
    const options = parseJsonArg((args as any).options, '--options')
    if (!Array.isArray(options)) throw new CliError('--options must be a JSON array', 2)
    const variantStrategy = (args as any)['variant-strategy'] as string | undefined

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
        __args: {
          productId,
          options,
          ...(variantStrategy ? { variantStrategy } : {}),
        },
        product: selection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productOptionsCreate, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: result.productOptionsCreate?.product, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'options-delete') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'option-ids': { type: 'string', multiple: true },
        strategy: { type: 'string' },
      },
    })
    const productId = requireId((args as any)['product-id'], 'Product')
    const options = parseStringList((args as any)['option-ids'], '--option-ids')
    const strategy = args.strategy as string | undefined

    const result = await runMutation(ctx, {
      productOptionsDelete: {
        __args: { productId, options, ...(strategy ? { strategy } : {}) },
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

  if (verb === 'options-reorder') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        options: { type: 'string' },
      },
    })
    const productId = requireId((args as any)['product-id'], 'Product')
    const options = parseJsonArg((args as any).options, '--options')
    if (!Array.isArray(options)) throw new CliError('--options must be a JSON array', 2)

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
    const parentProductId = requireId((args as any)['parent-product-id'], 'Product')

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

    const mutation = verb === 'bundle-create' ? 'productBundleCreate' : 'productBundleUpdate'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { input: built.input },
        productBundleOperation: {
          id: true,
          status: true,
          product: { id: true, title: true },
          userErrors: { field: true, message: true },
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.productBundleOperation?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
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
        'publication-id': { type: 'string', multiple: true },
        publication: { type: 'string', multiple: true },
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })

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
        id: args.id,
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
      id: args.id,
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
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })

    if (ctx.dryRun) {
      await listPublications(ctx)
      return
    }

    const publishDate = parsePublishDate({ at: args.at as any, now: args.now as any })
    const publications = await listPublications(ctx)
    const publicationIds = publications.map((p) => p.id).filter(Boolean)
    if (publicationIds.length === 0) throw new CliError('No publications found to publish to', 2)

    const payload = await publishProduct({
      ctx,
      id: args.id,
      publicationIds,
      publishDate,
    })
    if (payload === undefined) return
    if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
    printJson(payload)
    return
  }

  if (verb === 'metafields upsert') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await metafieldsUpsert({ ctx, id: args.id, input: built.input })
    if (result === undefined) return

    printJson(result)
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')

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
        __args: { input: built.input },
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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Product')
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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }

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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')

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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
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

    const variantId = requireId((args as any)['variant-id'], 'ProductVariant')
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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
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
        url: { type: 'string', multiple: true },
        alt: { type: 'string' },
        'media-type': { type: 'string' },
        'media-content-type': { type: 'string' },
        wait: { type: 'boolean' },
        'poll-interval-ms': { type: 'string' },
        'timeout-ms': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Product')

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
    const beforeIds = shouldWait ? await getTopProductMediaIds({ ctx, productId: id }) : []

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
    if (!shouldWait) {
      const connection = result.productUpdate?.product?.media ?? { nodes: [], pageInfo: undefined }
      printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
      return
    }

    const afterIds = await getTopProductMediaIds({ ctx, productId: id })
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
    const id = requireId(args.id, 'Product')

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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Product')
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
        extraFlags: [{ flag: '--id', value: id }],
      },
    })
    return
  }

  if (verb === 'media remove') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'media-id': { type: 'string', multiple: true },
      },
    })
    const productId = requireId(args.id as any, 'Product')
    const mediaIds = ((args as any)['media-id'] as string[] | undefined) ?? []
    if (mediaIds.length === 0) throw new CliError('Missing --media-id (repeatable)', 2)

    const files = mediaIds.map((id) => ({
      id: normalizeMediaId(id),
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
    if (ctx.quiet) return console.log(productId)
    printJson(result.fileUpdate, ctx.format !== 'raw')
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

    const files = [{ id: normalizeMediaId(mediaIdRaw), alt }]

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
        moves: { type: 'string' },
        move: { type: 'string', multiple: true },
      },
    })
    const id = requireId(args.id as any, 'Product')

    let moves: Array<{ id: string; newPosition: number }> = []
    if ((args as any).moves) {
      try {
        const parsed = JSON.parse((args as any).moves as string)
        if (!Array.isArray(parsed)) throw new CliError('--moves must be a JSON array', 2)
        moves = parsed as any
      } catch (err) {
        throw new CliError(`--moves must be valid JSON: ${(err as Error).message}`, 2)
      }
    } else if ((args as any).move) {
      const raw = (args as any).move as string[]
      const parsedMoves: Array<{ id: string; newPosition: number }> = []
      for (const item of raw) {
        const parts = item.split(':')
        if (parts.length !== 2) throw new CliError('--move must be <mediaId>:<newPosition>', 2)
        const mediaId = parts[0]!.trim()
        const pos = Number(parts[1]!.trim())
        if (!mediaId) throw new CliError('--move mediaId cannot be empty', 2)
        if (!Number.isFinite(pos) || pos < 0) throw new CliError('--move newPosition must be a non-negative number', 2)
        parsedMoves.push({ id: normalizeMediaId(mediaId), newPosition: Math.floor(pos) } as any)
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
      return { id: normalizeMediaId(id), newPosition: Math.floor(pos) }
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
