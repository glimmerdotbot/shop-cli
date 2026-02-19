import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { upsertProductVariants } from '../workflows/productVariants/upsert'

import {
  buildListNextPageArgs,
  parseFirst,
  parseIds,
  parseJsonArg,
  parseStringList,
  requireId,
} from './_shared'

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

const resolveProductIdForVariant = async ({
  ctx,
  variantId,
}: {
  ctx: CommandContext
  variantId: string
}): Promise<string> => {
  if (ctx.dryRun) {
    throw new CliError('--dry-run cannot resolve product ID from variant; pass --product-id', 2)
  }
  const result = await runQuery(ctx, {
    productVariant: { __args: { id: variantId }, product: { id: true } },
  })
  const productId = result?.productVariant?.product?.id
  if (!productId) throw new CliError('Could not resolve product ID for variant', 2)
  return productId
}

const resolveBulkVariantsInput = (input: any) => {
  if (Array.isArray(input)) {
    return { variants: input as any[], media: undefined as any, strategy: undefined as any }
  }

  if (input && Array.isArray(input.variants)) {
    return { variants: input.variants as any[], media: input.media, strategy: input.strategy }
  }

  throw new CliError('--input must be a JSON array or an object with a variants array', 2)
}

export const runProductVariants = async ({
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
        '  shop product-variants <verb> [flags]',
        '',
        'Verbs:',
        '  get|get-by-identifier|by-identifier|list|count',
        '  bulk-create|bulk-update|bulk-delete|bulk-reorder',
        '  append-media|detach-media',
        '  join-selling-plans|leave-selling-plans',
        '  update-relationships',
        '  upsert',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'by-identifier') verb = 'get-by-identifier'

  if (verb === 'upsert') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'allow-partial-updates': { type: 'boolean' },
        strategy: { type: 'string' },
      },
    })

    const strategy = args.strategy as string | undefined
    if (
      strategy &&
      !['DEFAULT', 'PRESERVE_STANDALONE_VARIANT', 'REMOVE_STANDALONE_VARIANT'].includes(strategy)
    ) {
      throw new CliError(
        `--strategy must be one of DEFAULT|PRESERVE_STANDALONE_VARIANT|REMOVE_STANDALONE_VARIANT. Got: ${strategy}`,
        2,
      )
    }

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const payload = await upsertProductVariants({
      ctx,
      productId: args['product-id'] as any,
      input: built.input,
      allowPartialUpdates: Boolean(args['allow-partial-updates']),
      strategy,
    })
    if (payload === undefined) return

    printJson(payload)
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ProductVariant')
    const selection = resolveSelection({
      resource: 'product-variants',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { productVariant: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.productVariant, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get-by-identifier') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'product-id': { type: 'string' }, sku: { type: 'string' }, barcode: { type: 'string' } },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    let identifier = built.used ? (built.input as any) : undefined
    if (!identifier) {
      const productId = requireId(args['product-id'], 'Product')
      const sku = args.sku as string | undefined
      const barcode = args.barcode as string | undefined
      if (!sku && !barcode) throw new CliError('Missing --sku or --barcode', 2)
      identifier = { productId, ...(sku ? { sku } : {}), ...(barcode ? { barcode } : {}) }
    }

    const selection = resolveSelection({
      resource: 'product-variants',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { productVariantByIdentifier: { __args: { identifier }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.productVariantByIdentifier, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'product-variants',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      productVariants: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.productVariants,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('product-variants', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { productVariantsCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.productVariantsCount?.count ?? '')
    printJson(result.productVariantsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-create' || verb === 'bulk-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'product-id': { type: 'string' }, 'allow-partial-updates': { type: 'boolean' } },
    })
    const productId = requireId(args['product-id'], 'Product')

    const nodeSelection = resolveSelection({
      resource: 'product-variants',
      view: ctx.view,
      baseSelection: getProductVariantSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    if (verb === 'bulk-create') {
      const input = built.input as any
      const { variants, media, strategy } = resolveBulkVariantsInput(input)
      const result = await runMutation(ctx, {
        productVariantsBulkCreate: {
          __args: { productId, ...(media ? { media } : {}), ...(strategy ? { strategy } : {}), variants },
          productVariants: nodeSelection,
          userErrors: { field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.productVariantsBulkCreate, failOnUserErrors: ctx.failOnUserErrors })
      const nodes = ((result.productVariantsBulkCreate?.productVariants ?? []) as any[]).map((v) =>
        v && typeof v === 'object' ? { ...v, productId } : v,
      )
      printConnection({ connection: { nodes, pageInfo: undefined }, format: ctx.format, quiet: ctx.quiet })
      return
    }

    const input = built.input as any
    const { variants, media } = resolveBulkVariantsInput(input)
    const allowPartialUpdates = Boolean(args['allow-partial-updates'])

    const result = await runMutation(ctx, {
      productVariantsBulkUpdate: {
        __args: {
          productId,
          allowPartialUpdates,
          ...(media ? { media } : {}),
          variants,
        },
        productVariants: nodeSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productVariantsBulkUpdate, failOnUserErrors: ctx.failOnUserErrors })
    const nodes = ((result.productVariantsBulkUpdate?.productVariants ?? []) as any[]).map((v) =>
      v && typeof v === 'object' ? { ...v, productId } : v,
    )
    printConnection({ connection: { nodes, pageInfo: undefined }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const productId = requireId(args['product-id'], 'Product')
    const variantsIds = parseIds(args['variant-ids'] ?? args.ids, 'ProductVariant')

    const result = await runMutation(ctx, {
      productVariantsBulkDelete: {
        __args: { productId, variantsIds },
        product: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productVariantsBulkDelete, failOnUserErrors: ctx.failOnUserErrors })

    const verify = await runQuery(ctx, {
      nodes: {
        __args: { ids: variantsIds },
        id: true,
      },
    })
    const afterNodes = (verify?.nodes ?? []) as Array<any | null | undefined>
    const deletedVariantIds: string[] = []
    for (let i = 0; i < variantsIds.length; i++) {
      const id = variantsIds[i]!
      const node = afterNodes[i]
      if (node === null || node === undefined) deletedVariantIds.push(id)
    }

    if (ctx.quiet) return printIds(deletedVariantIds)

    printJson(
      {
        productId,
        deletedVariantIds,
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'bulk-reorder') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' }, positions: { type: 'string' } } })
    const productId = requireId(args['product-id'], 'Product')
    const positions = parseJsonArg(args.positions, '--positions')

    const result = await runMutation(ctx, {
      productVariantsBulkReorder: {
        __args: { productId, positions },
        product: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productVariantsBulkReorder, failOnUserErrors: ctx.failOnUserErrors })

    const reorderedVariantIds = Array.isArray(positions)
      ? positions
          .filter((p) => p && typeof p === 'object')
          .slice()
          .sort((a: any, b: any) => Number(a?.position ?? 0) - Number(b?.position ?? 0))
          .map((p: any) => p?.id)
          .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      : []

    if (ctx.quiet) return printIds(reorderedVariantIds)

    printJson(
      {
        productId,
        reorderedVariantIds,
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'append-media' || verb === 'detach-media') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'media-ids': { type: 'string', multiple: true },
        'variant-media': { type: 'string' },
      },
    })
    const variantId = requireId(args.id, 'ProductVariant')
    const productId = args['product-id']
      ? requireId(args['product-id'], 'Product')
      : await resolveProductIdForVariant({ ctx, variantId })

    let variantMedia = undefined as any
    if (args['variant-media']) {
      variantMedia = parseJsonArg(args['variant-media'], '--variant-media')
    } else {
      const mediaIds = parseStringList(args['media-ids'], '--media-ids')
      variantMedia = [{ variantId, mediaIds }]
    }

    const mutation = verb === 'append-media' ? 'productVariantAppendMedia' : 'productVariantDetachMedia'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { productId, variantMedia },
        productVariants: resolveSelection({
          resource: 'product-variants',
          view: ctx.view,
          baseSelection: getProductVariantSelection(ctx.view) as any,
          select: args.select,
          selection: (args as any).selection,
          include: args.include,
          ensureId: ctx.quiet,
        }),
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })

    const nodes = ((payload?.productVariants ?? []) as any[]).map((v) =>
      v && typeof v === 'object' ? { ...v, productId } : v,
    )
    printConnection({ connection: { nodes, pageInfo: undefined }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'join-selling-plans' || verb === 'leave-selling-plans') {
    const args = parseStandardArgs({ argv, extraOptions: { 'group-ids': { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'ProductVariant')
    const sellingPlanGroupIds = parseIds(args['group-ids'], 'SellingPlanGroup')

    const mutation = verb === 'join-selling-plans'
      ? 'productVariantJoinSellingPlanGroups'
      : 'productVariantLeaveSellingPlanGroups'

    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { id, sellingPlanGroupIds },
        productVariant: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-relationships') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      productVariantRelationshipBulkUpdate: {
        __args: { input: built.input },
        parentProductVariants: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantRelationshipBulkUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.productVariantRelationshipBulkUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for product-variants: ${verb}`, 2)
}
