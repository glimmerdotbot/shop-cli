import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseFirst, parseIds, requireId } from './_shared'

const fulfillmentServiceSummarySelection = {
  id: true,
  serviceName: true,
  handle: true,
  fulfillmentOrdersOptIn: true,
  inventoryManagement: true,
  trackingSupport: true,
  requiresShippingMethod: true,
  type: true,
  location: { id: true, name: true },
} as const

const fulfillmentServiceFullSelection = {
  ...fulfillmentServiceSummarySelection,
  callbackUrl: true,
} as const

const getFulfillmentServiceSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return fulfillmentServiceFullSelection
  if (view === 'raw') return {} as const
  return fulfillmentServiceSummarySelection
}

const pickFulfillmentServiceArgs = (value: any) => {
  if (value === null || typeof value !== 'object') throw new CliError('Fulfillment service input must be an object', 2)
  const out: any = {}
  if (value.name !== undefined) out.name = value.name
  if (value.callbackUrl !== undefined) out.callbackUrl = value.callbackUrl
  if (value.trackingSupport !== undefined) out.trackingSupport = value.trackingSupport
  if (value.inventoryManagement !== undefined) out.inventoryManagement = value.inventoryManagement
  if (value.requiresShippingMethod !== undefined) out.requiresShippingMethod = value.requiresShippingMethod
  if (value.fulfillmentOrdersOptIn !== undefined) out.fulfillmentOrdersOptIn = value.fulfillmentOrdersOptIn
  return out
}

export const runFulfillmentServices = async ({
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
        'Usage: shop fulfillment-services <verb> [flags]',
        '',
        'Verbs:',
        '  create  Create a fulfillment service',
        '  get     Get a fulfillment service by ID',
        '  list    List fulfillment services',
        '  update  Update a fulfillment service',
        '  delete  Delete a fulfillment service',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Special flags:',
        '  --destination-location-id <gid|num>  (delete)',
        '  --inventory-action <TRANSFER|KEEP|DELETE>  (delete)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'FulfillmentService')
    const selection = resolveSelection({
      resource: 'fulfillment-services',
      view: ctx.view,
      baseSelection: getFulfillmentServiceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { fulfillmentService: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.fulfillmentService, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)

    const nodeSelection = resolveSelection({
      resource: 'fulfillment-services',
      view: ctx.view,
      baseSelection: getFulfillmentServiceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { shop: { fulfillmentServices: nodeSelection } })
    if (result === undefined) return
    const nodes = result.shop?.fulfillmentServices ?? []
    const limited = nodes.slice(0, first)
    printConnection({ connection: { nodes: limited }, format: ctx.format, quiet: ctx.quiet })
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
    const input = pickFulfillmentServiceArgs(built.input)
    if (!input.name) throw new CliError('Missing name in --input/--set', 2)

    const result = await runMutation(ctx, {
      fulfillmentServiceCreate: {
        __args: input,
        fulfillmentService: fulfillmentServiceSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentServiceCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentServiceCreate?.fulfillmentService?.id ?? '')
    printJson(result.fulfillmentServiceCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'FulfillmentService')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = pickFulfillmentServiceArgs(built.input)
    if (Object.keys(input).length === 0) {
      throw new CliError('Nothing to update (expected at least one field)', 2)
    }

    const result = await runMutation(ctx, {
      fulfillmentServiceUpdate: {
        __args: { id, ...input },
        fulfillmentService: fulfillmentServiceSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentServiceUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentServiceUpdate?.fulfillmentService?.id ?? '')
    printJson(result.fulfillmentServiceUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'destination-location-id': { type: 'string' },
        'inventory-action': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'FulfillmentService')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)
    const destinationLocationId = (args as any)['destination-location-id'] as string | undefined
    const inventoryAction = (args as any)['inventory-action'] as string | undefined

    const result = await runMutation(ctx, {
      fulfillmentServiceDelete: {
        __args: {
          id,
          ...(destinationLocationId ? { destinationLocationId: requireId(destinationLocationId, 'Location') } : {}),
          ...(inventoryAction ? { inventoryAction } : {}),
        },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentServiceDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentServiceDelete?.deletedId ?? '')
    printJson(result.fulfillmentServiceDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for fulfillment-services: ${verb}`, 2)
}
