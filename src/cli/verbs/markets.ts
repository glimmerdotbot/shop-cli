import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseCsv, parseFirst, parseIds, requireId } from './_shared'

const marketSummarySelection = {
  id: true,
  name: true,
  handle: true,
  status: true,
  type: true,
} as const

const getMarketSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return marketSummarySelection
}

const requireCountryCode = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) throw new CliError('Missing --country-code', 2)
  return value.trim().toUpperCase()
}

const marketRegionCountrySummarySelection = {
  id: true,
  code: true,
  name: true,
} as const

export const runMarkets = async ({
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
        '  shop markets <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
        '  by-geography|primary|resolved-values',
        '  currency-settings-update|regions-create|regions-delete|region-delete',
        '',
        'Common output flags:',
        '  --view summary|ids|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Market')
    const selection = resolveSelection({
      resource: 'markets',
      view: ctx.view,
      baseSelection: getMarketSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { market: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.market, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const type = args.type as any

    const nodeSelection = resolveSelection({
      resource: 'markets',
      view: ctx.view,
      baseSelection: getMarketSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      markets: {
        __args: { first, after, query, reverse, sortKey, ...(type ? { type } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.markets,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'markets',
        { first, query, sort: sortKey, reverse },
        type ? [{ flag: '--type', value: type }] : undefined,
      ),
    })
    return
  }

  if (verb === 'by-geography') {
    const args = parseStandardArgs({ argv, extraOptions: { 'country-code': { type: 'string' } } })
    const countryCode = requireCountryCode((args as any)['country-code'])

    const selection = resolveSelection({
      resource: 'markets',
      view: ctx.view,
      baseSelection: getMarketSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      marketByGeography: { __args: { countryCode: countryCode as any }, ...selection },
    })
    if (result === undefined) return
    printNode({ node: result.marketByGeography, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'primary') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      resource: 'markets',
      view: ctx.view,
      baseSelection: getMarketSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { primaryMarket: selection })
    if (result === undefined) return
    printNode({ node: result.primaryMarket, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'resolved-values') {
    const args = parseStandardArgs({ argv, extraOptions: { 'country-code': { type: 'string' } } })
    const countryCode = requireCountryCode((args as any)['country-code'])

    const result = await runQuery(ctx, {
      marketsResolvedValues: {
        __args: { buyerSignal: { countryCode: countryCode as any } },
        currencyCode: true,
        priceInclusivity: {
          dutiesIncluded: true,
          taxesIncluded: true,
        },
        catalogs: { __args: { first: 5 }, nodes: { id: true, title: true } },
        webPresences: { __args: { first: 5 }, nodes: { id: true, domain: { host: true }, subfolderSuffix: true } },
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.marketsResolvedValues, ctx.format !== 'raw')
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

    const result = await runMutation(ctx, {
      marketCreate: {
        __args: { input: built.input },
        market: marketSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.marketCreate?.market?.id ?? '')
    printJson(result.marketCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'currency-settings-update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const marketId = requireId(args.id, 'Market')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      marketCurrencySettingsUpdate: {
        __args: { marketId, input: built.input },
        market: marketSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.marketCurrencySettingsUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.marketCurrencySettingsUpdate?.market?.id ?? '')
    printJson(result.marketCurrencySettingsUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'regions-create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'country-codes': { type: 'string' } } })
    const marketId = requireId(args.id, 'Market')
    const countryCodes = parseCsv((args as any)['country-codes'], '--country-codes')
    const regions = countryCodes.map((countryCode) => ({ countryCode: countryCode.toUpperCase() as any }))

    const result = await runMutation(ctx, {
      marketRegionsCreate: {
        __args: { marketId, regions },
        market: { id: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketRegionsCreate, failOnUserErrors: ctx.failOnUserErrors })

    const createdCodeSet = new Set(countryCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))

    const regionsResult = await runQuery(ctx, {
      market: {
        __args: { id: marketId },
        conditions: {
          regionsCondition: {
            applicationLevel: true,
            regions: {
              __args: { first: 250 },
              nodes: marketRegionCountrySummarySelection,
              pageInfo: { hasNextPage: true, endCursor: true },
            },
          },
        },
      },
    })
    if (regionsResult === undefined) return

    const allRegions: any[] = regionsResult.market?.conditions?.regionsCondition?.regions?.nodes ?? []
    const matchedRegions = allRegions.filter((r) => createdCodeSet.has(String(r?.code ?? '').toUpperCase()))

    if (ctx.quiet) {
      for (const r of matchedRegions) {
        const id = typeof r?.id === 'string' ? r.id : undefined
        if (id) process.stdout.write(`${id}\n`)
      }
      return
    }

    printJson(
      { regions: matchedRegions, userErrors: result.marketRegionsCreate?.userErrors ?? [] },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'regions-delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)
    const ids = parseIds(args.ids as any, 'MarketRegionCountry')

    const result = await runMutation(ctx, {
      marketRegionsDelete: {
        __args: { ids },
        deletedIds: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketRegionsDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return
    printJson(result.marketRegionsDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'region-delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MarketRegionCountry')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      marketRegionDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketRegionDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.marketRegionDelete?.deletedId ?? '')
    printJson(result.marketRegionDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Market')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      marketUpdate: {
        __args: { id, input: built.input },
        market: marketSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.marketUpdate?.market?.id ?? '')
    printJson(result.marketUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Market')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      marketDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.marketDelete?.deletedId ?? '')
    printJson(result.marketDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for markets: ${verb}`, 2)
}
