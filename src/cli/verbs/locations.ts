import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseCsv, parseFirst, parseIds, requireId } from './_shared'

const locationSummarySelection = {
  id: true,
  name: true,
  address: {
    address1: true,
    city: true,
    provinceCode: true,
    countryCode: true,
    zip: true,
  },
  isActive: true,
  fulfillsOnlineOrders: true,
  hasActiveInventory: true,
  localPickupSettingsV2: { instructions: true, pickupTime: true },
} as const

const locationFullSelection = {
  ...locationSummarySelection,
  address: {
    address1: true,
    address2: true,
    city: true,
    province: true,
    provinceCode: true,
    country: true,
    countryCode: true,
    zip: true,
    phone: true,
    formatted: true,
  },
  fulfillmentService: { id: true, serviceName: true },
  shipsInventory: true,
  suggestedAddresses: { address1: true, city: true, zip: true },
} as const

const getLocationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return locationFullSelection
  if (view === 'raw') return {} as const
  return locationSummarySelection
}

const ensureObjectInput = (value: any, label: string) => {
  if (value === null || typeof value !== 'object') throw new CliError(`${label} must be an object`, 2)
  return value as Record<string, any>
}

const maybeFailOnNamedUserErrors = (errors: unknown, ctx: CommandContext) => {
  if (!Array.isArray(errors) || errors.length === 0) return
  maybeFailOnUserErrors({ payload: { userErrors: errors }, failOnUserErrors: ctx.failOnUserErrors })
}

const parseCustomIdInput = ({
  namespace,
  key,
  value,
}: {
  namespace?: unknown
  key?: unknown
  value?: unknown
}) => {
  const customKey = typeof key === 'string' ? key : undefined
  const customValue = typeof value === 'string' ? value : undefined
  if (!customKey || !customValue) return undefined
  const ns = typeof namespace === 'string' && namespace ? namespace : undefined
  return { ...(ns ? { namespace: ns } : {}), key: customKey, value: customValue }
}

export const runLocations = async ({
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
        '  shop locations <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete',
        '  by-identifier',
        '  activate|deactivate|enable-local-pickup|disable-local-pickup',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Special flags:',
        '  --destination-location-id <gid|num>  (deactivate)',
        '  --include-inactive                     (list)',
        '  --include-legacy                       (list)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'by-identifier') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'custom-id-namespace': { type: 'string' },
        'custom-id-key': { type: 'string' },
        'custom-id-value': { type: 'string' },
      },
    })

    const idRaw = args.id as string | undefined
    const customId = parseCustomIdInput({
      namespace: (args as any)['custom-id-namespace'],
      key: (args as any)['custom-id-key'],
      value: (args as any)['custom-id-value'],
    })

    if (!idRaw && !customId) throw new CliError('Missing --id or --custom-id-key/--custom-id-value', 2)

    const identifier: any = {
      ...(idRaw ? { id: coerceGid(idRaw, 'Location') } : {}),
      ...(customId ? { customId } : {}),
    }

    const selection = resolveSelection({
      resource: 'locations',
      view: ctx.view,
      baseSelection: getLocationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      locationByIdentifier: {
        __args: { identifier },
        ...selection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.locationByIdentifier, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Location')
    const selection = resolveSelection({
      resource: 'locations',
      view: ctx.view,
      baseSelection: getLocationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { location: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.location, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'include-inactive': { type: 'boolean' },
        'include-legacy': { type: 'boolean' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const includeInactive = (args as any)['include-inactive'] as boolean | undefined
    const includeLegacy = (args as any)['include-legacy'] as boolean | undefined

    const nodeSelection = resolveSelection({
      resource: 'locations',
      view: ctx.view,
      baseSelection: getLocationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      locations: {
        __args: {
          first,
          after,
          query,
          reverse,
          sortKey,
          ...(includeInactive ? { includeInactive } : {}),
          ...(includeLegacy ? { includeLegacy } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.locations,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'locations',
        { first, query, sort: sortKey, reverse },
        [
          ...(includeInactive ? [{ flag: '--include-inactive', value: true }] : []),
          ...(includeLegacy ? [{ flag: '--include-legacy', value: true }] : []),
        ],
      ),
    })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { locationsCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.locationsCount?.count ?? '')
    printJson(result.locationsCount, ctx.format !== 'raw')
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
      locationAdd: {
        __args: { input: built.input },
        location: locationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.locationAdd, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.locationAdd?.location?.id ?? '')
    printJson(result.locationAdd, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Location')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      locationEdit: {
        __args: { id, input: built.input },
        location: locationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.locationEdit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.locationEdit?.location?.id ?? '')
    printJson(result.locationEdit, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Location')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      locationDelete: {
        __args: { locationId: id },
        deletedLocationId: true,
        locationDeleteUserErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnNamedUserErrors(result.locationDelete?.locationDeleteUserErrors, ctx)
    if (ctx.quiet) return console.log(result.locationDelete?.deletedLocationId ?? '')
    printJson(result.locationDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'activate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Location')

    const result = await runMutation(ctx, {
      locationActivate: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { locationId: id },
        location: locationSummarySelection,
        locationActivateUserErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnNamedUserErrors(result.locationActivate?.locationActivateUserErrors, ctx)
    if (ctx.quiet) return console.log(result.locationActivate?.location?.id ?? '')
    printJson(result.locationActivate, ctx.format !== 'raw')
    return
  }

  if (verb === 'deactivate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'destination-location-id': { type: 'string' } } })
    const id = requireId(args.id, 'Location')
    const destinationLocationId = (args as any)['destination-location-id'] as string | undefined

    const result = await runMutation(ctx, {
      locationDeactivate: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: {
          locationId: id,
          ...(destinationLocationId ? { destinationLocationId: requireId(destinationLocationId, 'Location') } : {}),
        },
        location: locationSummarySelection,
        locationDeactivateUserErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnNamedUserErrors(result.locationDeactivate?.locationDeactivateUserErrors, ctx)
    if (ctx.quiet) return console.log(result.locationDeactivate?.location?.id ?? '')
    printJson(result.locationDeactivate, ctx.format !== 'raw')
    return
  }

  if (verb === 'enable-local-pickup') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Location')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = ensureObjectInput(built.input, 'Local pickup settings')
    if (input.locationId === undefined) input.locationId = id
    if (!input.locationId) throw new CliError('Missing locationId in --input/--set (or provide --id)', 2)
    if (input.pickupTime === undefined) throw new CliError('Missing pickupTime in --input/--set', 2)

    const result = await runMutation(ctx, {
      locationLocalPickupEnable: {
        __args: { localPickupSettings: input },
        localPickupSettings: { instructions: true, pickupTime: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.locationLocalPickupEnable, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.locationLocalPickupEnable, ctx.format !== 'raw')
    return
  }

  if (verb === 'disable-local-pickup') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Location')

    const result = await runMutation(ctx, {
      locationLocalPickupDisable: {
        __args: { locationId: id },
        locationId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.locationLocalPickupDisable, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.locationLocalPickupDisable?.locationId ?? '')
    printJson(result.locationLocalPickupDisable, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for locations: ${verb}`, 2)
}
