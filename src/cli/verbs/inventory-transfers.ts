import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIds, requireId } from './_shared'

const inventoryTransferSummarySelection = {
  id: true,
  name: true,
  status: true,
  referenceName: true,
  origin: { name: true, location: { id: true, name: true } },
  destination: { name: true, location: { id: true, name: true } },
  dateCreated: true,
  totalQuantity: true,
  receivedQuantity: true,
} as const

const inventoryTransferFullSelection = {
  ...inventoryTransferSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      inventoryItem: { id: true, sku: true },
      title: true,
      totalQuantity: true,
      processableQuantity: true,
      shippedQuantity: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
  tags: true,
  note: true,
  events: {
    __args: { first: 10 },
    nodes: {
      id: true,
      createdAt: true,
      message: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
} as const

const getInventoryTransferSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return inventoryTransferFullSelection
  if (view === 'raw') return {} as const
  return inventoryTransferSummarySelection
}

const mergeLocationOverrides = ({
  input,
  originLocationId,
  destinationLocationId,
  useCreateKeys,
}: {
  input: any
  originLocationId?: string
  destinationLocationId?: string
  useCreateKeys: boolean
}) => {
  if (!originLocationId && !destinationLocationId) return input
  const base = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const originKey = useCreateKeys ? 'originLocationId' : 'originId'
  const destinationKey = useCreateKeys ? 'destinationLocationId' : 'destinationId'
  return {
    ...base,
    ...(originLocationId ? { [originKey]: coerceGid(originLocationId, 'Location') } : {}),
    ...(destinationLocationId ? { [destinationKey]: coerceGid(destinationLocationId, 'Location') } : {}),
  }
}

const hasListArg = (value: unknown) => (Array.isArray(value) ? value.length > 0 : value !== undefined)

const resolveTransferLineItemIds = async ({
  ctx,
  transferId,
  transferLineItemIds,
  inventoryItemIds,
}: {
  ctx: CommandContext
  transferId: string
  transferLineItemIds?: string[]
  inventoryItemIds?: string[]
}) => {
  if (transferLineItemIds && transferLineItemIds.length > 0) return transferLineItemIds
  if (!inventoryItemIds || inventoryItemIds.length === 0) {
    throw new CliError('Missing --transfer-line-item-ids or --inventory-item-ids', 2)
  }

  const result = await runQuery(ctx, {
    inventoryTransfer: {
      __args: { id: transferId },
      lineItems: { __args: { first: 250 }, nodes: { id: true, inventoryItem: { id: true } } },
    },
  })
  if (result === undefined) return []

  const nodes = result.inventoryTransfer?.lineItems?.nodes ?? []
  const map = new Map<string, string>()
  for (const node of nodes) {
    const inventoryItemId = node?.inventoryItem?.id
    if (inventoryItemId && node?.id) map.set(inventoryItemId, node.id)
  }

  const missing: string[] = []
  const ids: string[] = []
  for (const inventoryItemId of inventoryItemIds) {
    const id = map.get(inventoryItemId)
    if (!id) missing.push(inventoryItemId)
    else ids.push(id)
  }
  if (missing.length > 0) {
    throw new CliError(`No transfer line items found for inventory item IDs: ${missing.join(', ')}`, 2)
  }
  return ids
}

export const runInventoryTransfers = async ({
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
        '  shop inventory-transfers <verb> [flags]',
        '',
        'Verbs:',
        '  create|create-ready|get|list|edit|delete|duplicate',
        '  mark-ready|cancel|set-items|remove-items',
        '',
        'State transitions:',
        '  DRAFT -> READY_TO_SHIP -> IN_TRANSIT -> RECEIVED',
        '  cancel allowed for DRAFT/READY_TO_SHIP only',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Notes:',
        '  --origin-location-id / --destination-location-id can be used with create/create-ready/edit.',
        '  remove-items accepts --transfer-line-item-ids or --inventory-item-ids.',
        '  delete requires --yes.',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryTransfer')
    const selection = resolveSelection({
      resource: 'inventory-transfers',
      view: ctx.view,
      baseSelection: getInventoryTransferSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { inventoryTransfer: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.inventoryTransfer, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'inventory-transfers',
      view: ctx.view,
      baseSelection: getInventoryTransferSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      inventoryTransfers: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.inventoryTransfers, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create' || verb === 'create-ready') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'origin-location-id': { type: 'string' },
        'destination-location-id': { type: 'string' },
      },
    })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = mergeLocationOverrides({
      input: built.input,
      originLocationId: args['origin-location-id'] as any,
      destinationLocationId: args['destination-location-id'] as any,
      useCreateKeys: true,
    })

    const mutationField =
      verb === 'create' ? 'inventoryTransferCreate' : 'inventoryTransferCreateAsReadyToShip'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input },
        inventoryTransfer: inventoryTransferSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.inventoryTransfer?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'edit') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'origin-location-id': { type: 'string' },
        'destination-location-id': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'InventoryTransfer')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = mergeLocationOverrides({
      input: built.input,
      originLocationId: args['origin-location-id'] as any,
      destinationLocationId: args['destination-location-id'] as any,
      useCreateKeys: false,
    })

    const result = await runMutation(ctx, {
      inventoryTransferEdit: {
        __args: { id, input },
        inventoryTransfer: inventoryTransferSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryTransferEdit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryTransferEdit?.inventoryTransfer?.id ?? '')
    printJson(result.inventoryTransferEdit, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryTransfer')

    const result = await runMutation(ctx, {
      inventoryTransferDuplicate: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { id },
        inventoryTransfer: inventoryTransferSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryTransferDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryTransferDuplicate?.inventoryTransfer?.id ?? '')
    printJson(result.inventoryTransferDuplicate, ctx.format !== 'raw')
    return
  }

  if (verb === 'mark-ready' || verb === 'cancel') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryTransfer')
    const mutationField =
      verb === 'mark-ready' ? 'inventoryTransferMarkAsReadyToShip' : 'inventoryTransferCancel'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { id },
        inventoryTransfer: inventoryTransferSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.inventoryTransfer?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-items') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryTransfer')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const lineItems = Array.isArray(built.input) ? built.input : built.input?.lineItems
    if (!lineItems) throw new CliError('Expected lineItems array via --input or --set lineItems[0].*', 2)

    const result = await runMutation(ctx, {
      inventoryTransferSetItems: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input: { id, lineItems } },
        inventoryTransfer: inventoryTransferSummarySelection,
        updatedLineItems: { inventoryItemId: true, newQuantity: true, deltaQuantity: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryTransferSetItems, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryTransferSetItems?.inventoryTransfer?.id ?? '')
    printJson(result.inventoryTransferSetItems, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-items') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'transfer-line-item-ids': { type: 'string', multiple: true },
        'inventory-item-ids': { type: 'string', multiple: true },
      },
    })
    const id = requireId(args.id, 'InventoryTransfer')
    const rawTransferLineItemIds = (args as any)['transfer-line-item-ids']
    const rawInventoryItemIds = (args as any)['inventory-item-ids']
    const transferLineItemIds = hasListArg(rawTransferLineItemIds)
      ? parseIds(rawTransferLineItemIds, 'InventoryTransferLineItem')
      : undefined
    const inventoryItemIds = hasListArg(rawInventoryItemIds)
      ? parseIds(rawInventoryItemIds, 'InventoryItem')
      : undefined

    const resolved = await resolveTransferLineItemIds({
      ctx,
      transferId: id,
      transferLineItemIds,
      inventoryItemIds,
    })

    const result = await runMutation(ctx, {
      inventoryTransferRemoveItems: {
        __args: { input: { id, transferLineItemIds: resolved } },
        inventoryTransfer: inventoryTransferSummarySelection,
        removedQuantities: { inventoryItemId: true, newQuantity: true, deltaQuantity: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryTransferRemoveItems, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryTransferRemoveItems?.inventoryTransfer?.id ?? '')
    printJson(result.inventoryTransferRemoveItems, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'InventoryTransfer')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      inventoryTransferDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryTransferDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryTransferDelete?.deletedId ?? '')
    printJson(result.inventoryTransferDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for inventory-transfers: ${verb}`, 2)
}
