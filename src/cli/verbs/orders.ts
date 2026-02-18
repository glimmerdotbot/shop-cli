import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const orderSummarySelection = {
  id: true,
  name: true,
  displayFinancialStatus: true,
  displayFulfillmentStatus: true,
  processedAt: true,
  updatedAt: true,
} as const

const orderFullSelection = {
  ...orderSummarySelection,
  createdAt: true,
  tags: true,
} as const

const getOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return orderFullSelection
  if (view === 'raw') return {} as const
  return orderSummarySelection
}

export const runOrders = async ({
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
        '  shop orders <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
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
    const id = requireId(args.id as any, 'Order')
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { order: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.order, format: ctx.format, quiet: ctx.quiet })
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
      view: ctx.view,
      baseSelection: getOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      orders: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({ connection: result.orders, format: ctx.format, quiet: ctx.quiet })
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
      orderCreate: {
        __args: { order: built.input },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderCreate?.order?.id ?? '')
    printJson(result.orderCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Order')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }

    const result = await runMutation(ctx, {
      orderUpdate: {
        __args: { input },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderUpdate?.order?.id ?? '')
    printJson(result.orderUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Order')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      orderDelete: {
        __args: { orderId: id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderDelete?.deletedId ?? '')
    printJson(result.orderDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for orders: ${verb}`, 2)
}
