import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseJsonArg, parseStringList, requireId } from './_shared'

const inventoryShipmentSummarySelection = {
  id: true,
  name: true,
  status: true,
  dateCreated: true,
  dateShipped: true,
  dateReceived: true,
  lineItemTotalQuantity: true,
  totalAcceptedQuantity: true,
  totalReceivedQuantity: true,
  totalRejectedQuantity: true,
} as const

const inventoryShipmentFullSelection = {
  ...inventoryShipmentSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      inventoryItem: { id: true, sku: true },
      quantity: true,
      acceptedQuantity: true,
      rejectedQuantity: true,
      unreceivedQuantity: true,
    },
  },
  tracking: {
    arrivesAt: true,
    company: true,
    trackingNumber: true,
    trackingUrl: true,
  },
} as const

const getInventoryShipmentSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return inventoryShipmentFullSelection
  if (view === 'raw') return {} as const
  return inventoryShipmentSummarySelection
}

export const runInventoryShipments = async ({
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
        '  shop inventory-shipments <verb> [flags]',
        '',
        'Verbs:',
        '  create|create-in-transit|get|delete',
        '  add-items|remove-items|update-quantities',
        '  mark-in-transit|receive|set-tracking',
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
    const id = requireId(args.id, 'InventoryShipment')
    const selection = resolveSelection({
      resource: 'inventory-shipments',
      view: ctx.view,
      baseSelection: getInventoryShipmentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { inventoryShipment: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.inventoryShipment, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create' || verb === 'create-in-transit') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const mutation = verb === 'create' ? 'inventoryShipmentCreate' : 'inventoryShipmentCreateInTransit'
    const result = await runMutation(ctx, {
      [mutation]: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input: built.input },
        inventoryShipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.inventoryShipment?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryShipment')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      inventoryShipmentDelete: {
        __args: { id },
        id: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryShipmentDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryShipmentDelete?.id ?? '')
    printJson(result.inventoryShipmentDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-items') {
    const args = parseStandardArgs({ argv, extraOptions: { items: { type: 'string' } } })
    const id = requireId(args.id, 'InventoryShipment')
    const lineItems = parseJsonArg(args.items, '--items')

    const result = await runMutation(ctx, {
      inventoryShipmentAddItems: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { id, lineItems },
        inventoryShipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryShipmentAddItems, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.inventoryShipmentAddItems, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-items') {
    const args = parseStandardArgs({ argv, extraOptions: { 'line-item-ids': { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'InventoryShipment')
    const lineItems = parseStringList(args['line-item-ids'], '--line-item-ids')

    const result = await runMutation(ctx, {
      inventoryShipmentRemoveItems: {
        __args: { id, lineItems },
        inventoryShipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryShipmentRemoveItems, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.inventoryShipmentRemoveItems, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-quantities') {
    const args = parseStandardArgs({ argv, extraOptions: { items: { type: 'string' } } })
    const id = requireId(args.id, 'InventoryShipment')
    const items = parseJsonArg(args.items, '--items')

    const result = await runMutation(ctx, {
      inventoryShipmentUpdateItemQuantities: {
        __args: { id, items },
        shipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.inventoryShipmentUpdateItemQuantities,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.inventoryShipmentUpdateItemQuantities, ctx.format !== 'raw')
    return
  }

  if (verb === 'mark-in-transit') {
    const args = parseStandardArgs({ argv, extraOptions: { 'date-shipped': { type: 'string' } } })
    const id = requireId(args.id, 'InventoryShipment')
    const dateShipped = args['date-shipped'] as string | undefined

    const result = await runMutation(ctx, {
      inventoryShipmentMarkInTransit: {
        __args: { id, ...(dateShipped ? { dateShipped } : {}) },
        inventoryShipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.inventoryShipmentMarkInTransit,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.inventoryShipmentMarkInTransit, ctx.format !== 'raw')
    return
  }

  if (verb === 'receive') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'bulk-receive-action': { type: 'string' },
        'date-received': { type: 'string' },
        items: { type: 'string' },
      },
    })
    const id = requireId(args.id, 'InventoryShipment')
    const bulkReceiveAction = args['bulk-receive-action'] as string | undefined
    const dateReceived = args['date-received'] as string | undefined
    const lineItems = args.items ? parseJsonArg(args.items, '--items', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      inventoryShipmentReceive: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: {
          id,
          ...(bulkReceiveAction ? { bulkReceiveAction } : {}),
          ...(dateReceived ? { dateReceived } : {}),
          ...(lineItems ? { lineItems } : {}),
        },
        inventoryShipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryShipmentReceive, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.inventoryShipmentReceive, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-tracking') {
    const args = parseStandardArgs({ argv, extraOptions: { tracking: { type: 'string' } } })
    const id = requireId(args.id, 'InventoryShipment')
    const tracking = parseJsonArg(args.tracking, '--tracking')

    const result = await runMutation(ctx, {
      inventoryShipmentSetTracking: {
        __args: { id, tracking },
        inventoryShipment: inventoryShipmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryShipmentSetTracking, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.inventoryShipmentSetTracking, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for inventory-shipments: ${verb}`, 2)
}
