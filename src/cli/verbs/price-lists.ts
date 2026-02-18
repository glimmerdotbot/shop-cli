import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIds, requireId } from './_shared'

const priceListSummarySelection = {
  id: true,
  name: true,
  currency: true,
  catalog: { id: true, title: true },
  parent: {
    adjustment: {
      type: true,
      value: true,
    },
  },
  fixedPricesCount: true,
} as const

const priceListFullSelection = {
  ...priceListSummarySelection,
  prices: {
    __args: { first: 10 },
    nodes: {
      variant: { id: true, displayName: true },
      price: { amount: true, currencyCode: true },
      compareAtPrice: { amount: true, currencyCode: true },
      originType: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
  quantityRules: {
    __args: { first: 10 },
    nodes: {
      productVariant: { id: true, displayName: true },
      minimum: true,
      maximum: true,
      increment: true,
      originType: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
} as const

const getPriceListSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return priceListFullSelection
  if (view === 'raw') return {} as const
  return priceListSummarySelection
}

const ensureInput = (built: { input: any; used: boolean }) => {
  if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
  return built.input
}

const extractArrayField = (input: any, field: string) => {
  if (Array.isArray(input)) return input
  if (input && Array.isArray(input[field])) return input[field]
  return undefined
}

const hasListArg = (value: unknown) => (Array.isArray(value) ? value.length > 0 : value !== undefined)

export const runPriceLists = async ({
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
        '  shop price-lists <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
        '  add-prices|update-prices|update-prices-by-product|delete-prices',
        '  add-quantity-rules|delete-quantity-rules|update-quantity-pricing',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Notes:',
        '  --variant-ids <gid,gid,...> applies to delete-prices/delete-quantity-rules.',
        '  --product-id <gid> can be used with update-prices-by-product to target a single product.',
        '  delete operations require --yes.',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PriceList')
    const selection = resolveSelection({
      resource: 'price-lists',
      view: ctx.view,
      baseSelection: getPriceListSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { priceList: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.priceList, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'price-lists',
      view: ctx.view,
      baseSelection: getPriceListSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      priceLists: {
        __args: { first, after, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.priceLists, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)

    const result = await runMutation(ctx, {
      priceListCreate: {
        __args: { input },
        priceList: priceListSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.priceListCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.priceListCreate?.priceList?.id ?? '')
    printJson(result.priceListCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PriceList')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)

    const result = await runMutation(ctx, {
      priceListUpdate: {
        __args: { id, input },
        priceList: priceListSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.priceListUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.priceListUpdate?.priceList?.id ?? '')
    printJson(result.priceListUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PriceList')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      priceListDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.priceListDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.priceListDelete?.deletedId ?? '')
    printJson(result.priceListDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-prices') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const priceListId = requireId(args.id, 'PriceList')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)
    const prices = extractArrayField(input, 'prices')
    if (!prices) throw new CliError('Expected prices array via --input or --set prices[0].*', 2)

    const result = await runMutation(ctx, {
      priceListFixedPricesAdd: {
        __args: { priceListId, prices },
        prices: { variant: { id: true }, price: { amount: true, currencyCode: true } },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.priceListFixedPricesAdd, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const ids = (result.priceListFixedPricesAdd?.prices ?? []).map((p: any) => p?.variant?.id)
      printIds(ids)
      return
    }
    printJson(result.priceListFixedPricesAdd, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-prices') {
    const args = parseStandardArgs({ argv, extraOptions: { 'variant-ids': { type: 'string', multiple: true } } })
    const priceListId = requireId(args.id, 'PriceList')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)
    const pricesToAdd =
      input.pricesToAdd ??
      input.prices ??
      (Array.isArray(input) ? input : [])
    const rawVariantIds = (args as any)['variant-ids']
    const variantIdsToDelete =
      input.variantIdsToDelete ??
      (hasListArg(rawVariantIds) ? parseIds(rawVariantIds, 'ProductVariant') : [])

    if ((pricesToAdd?.length ?? 0) === 0 && (variantIdsToDelete?.length ?? 0) === 0) {
      throw new CliError('Expected pricesToAdd and/or variantIdsToDelete', 2)
    }

    const result = await runMutation(ctx, {
      priceListFixedPricesUpdate: {
        __args: { priceListId, pricesToAdd, variantIdsToDelete },
        priceList: { id: true },
        pricesAdded: { variant: { id: true }, price: { amount: true, currencyCode: true } },
        deletedFixedPriceVariantIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.priceListFixedPricesUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.priceListFixedPricesUpdate?.priceList?.id ?? '')
    printJson(result.priceListFixedPricesUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-prices-by-product') {
    const args = parseStandardArgs({ argv, extraOptions: { 'product-id': { type: 'string' } } })
    const priceListId = requireId(args.id, 'PriceList')
    const productId = args['product-id'] as string | undefined
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)

    let pricesToAdd = input.pricesToAdd
    let pricesToDeleteByProductIds = input.pricesToDeleteByProductIds

    if (!pricesToAdd && !pricesToDeleteByProductIds && productId) {
      const gid = coerceGid(productId, 'Product')
      if (Array.isArray(input)) {
        pricesToAdd = input.map((p) => ({ ...p, productId: p.productId ?? gid }))
      } else {
        const base = typeof input === 'object' && input !== null ? input : {}
        pricesToAdd = [{ ...base, productId: gid }]
      }
    }

    if ((pricesToAdd?.length ?? 0) === 0 && (pricesToDeleteByProductIds?.length ?? 0) === 0) {
      throw new CliError('Expected pricesToAdd and/or pricesToDeleteByProductIds', 2)
    }

    const result = await runMutation(ctx, {
      priceListFixedPricesByProductUpdate: {
        __args: { priceListId, pricesToAdd, pricesToDeleteByProductIds },
        priceList: { id: true },
        pricesToAddProducts: { id: true },
        pricesToDeleteProducts: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.priceListFixedPricesByProductUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.priceListFixedPricesByProductUpdate?.priceList?.id ?? '')
    printJson(result.priceListFixedPricesByProductUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-prices') {
    const args = parseStandardArgs({ argv, extraOptions: { 'variant-ids': { type: 'string', multiple: true } } })
    const priceListId = requireId(args.id, 'PriceList')
    if (!args.yes) throw new CliError('Refusing to delete prices without --yes', 2)
    const variantIds = parseIds((args as any)['variant-ids'], 'ProductVariant')

    const result = await runMutation(ctx, {
      priceListFixedPricesDelete: {
        __args: { priceListId, variantIds },
        deletedFixedPriceVariantIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.priceListFixedPricesDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      printIds(result.priceListFixedPricesDelete?.deletedFixedPriceVariantIds ?? [])
      return
    }
    printJson(result.priceListFixedPricesDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-quantity-rules') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const priceListId = requireId(args.id, 'PriceList')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)
    const quantityRules = extractArrayField(input, 'quantityRules')
    if (!quantityRules) throw new CliError('Expected quantityRules array via --input or --set quantityRules[0].*', 2)

    const result = await runMutation(ctx, {
      quantityRulesAdd: {
        __args: { priceListId, quantityRules },
        quantityRules: { productVariant: { id: true }, minimum: true, maximum: true, increment: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.quantityRulesAdd, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const ids = (result.quantityRulesAdd?.quantityRules ?? []).map((r: any) => r?.productVariant?.id)
      printIds(ids)
      return
    }
    printJson(result.quantityRulesAdd, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-quantity-rules') {
    const args = parseStandardArgs({ argv, extraOptions: { 'variant-ids': { type: 'string', multiple: true } } })
    const priceListId = requireId(args.id, 'PriceList')
    if (!args.yes) throw new CliError('Refusing to delete quantity rules without --yes', 2)
    const variantIds = parseIds((args as any)['variant-ids'], 'ProductVariant')

    const result = await runMutation(ctx, {
      quantityRulesDelete: {
        __args: { priceListId, variantIds },
        deletedQuantityRulesVariantIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.quantityRulesDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      printIds(result.quantityRulesDelete?.deletedQuantityRulesVariantIds ?? [])
      return
    }
    printJson(result.quantityRulesDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-quantity-pricing') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const priceListId = requireId(args.id, 'PriceList')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = ensureInput(built)

    const result = await runMutation(ctx, {
      quantityPricingByVariantUpdate: {
        __args: { priceListId, input },
        productVariants: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.quantityPricingByVariantUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) {
      printIds((result.quantityPricingByVariantUpdate?.productVariants ?? []).map((v: any) => v?.id))
      return
    }
    printJson(result.quantityPricingByVariantUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for price-lists: ${verb}`, 2)
}
