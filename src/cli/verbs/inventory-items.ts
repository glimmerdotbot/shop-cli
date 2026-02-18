import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const inventoryItemSummarySelection = {
  id: true,
  sku: true,
  tracked: true,
  requiresShipping: true,
  harmonizedSystemCode: true,
  countryCodeOfOrigin: true,
  provinceCodeOfOrigin: true,
  measurement: { weight: { value: true, unit: true } },
  variant: { id: true, displayName: true },
} as const

const inventoryItemFullSelection = {
  ...inventoryItemSummarySelection,
  unitCost: { amount: true, currencyCode: true },
  duplicateSkuCount: true,
  inventoryHistoryUrl: true,
  inventoryLevels: {
    __args: { first: 10 },
    nodes: {
      id: true,
      location: { id: true, name: true },
      quantities: { name: true, quantity: true },
    },
  },
  countryHarmonizedSystemCodes: {
    __args: { first: 10 },
    nodes: { countryCode: true, harmonizedSystemCode: true },
  },
} as const

const getInventoryItemSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return inventoryItemFullSelection
  if (view === 'raw') return {} as const
  return inventoryItemSummarySelection
}

export const runInventoryItems = async ({
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
        '  shop inventory-items <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|update',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryItem')
    const selection = resolveSelection({
      resource: 'inventory-items',
      view: ctx.view,
      baseSelection: getInventoryItemSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { inventoryItem: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.inventoryItem, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'inventory-items',
      view: ctx.view,
      baseSelection: getInventoryItemSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      inventoryItems: {
        __args: { first, after, query, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.inventoryItems,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('inventory-items', { first, query, reverse }),
    })
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryItem')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      inventoryItemUpdate: {
        __args: { id, input: built.input },
        inventoryItem: inventoryItemSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryItemUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryItemUpdate?.inventoryItem?.id ?? '')
    printJson(result.inventoryItemUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for inventory-items: ${verb}`, 2)
}
