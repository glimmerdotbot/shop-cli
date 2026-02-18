import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIntFlag, parseStringList, requireLocationId } from './_shared'

const deliveryPromiseSettingsSelection = {
  deliveryDatesEnabled: true,
  processingTime: true,
} as const

const deliveryPromiseProviderSelection = {
  id: true,
  active: true,
  fulfillmentDelay: true,
  timeZone: true,
  location: { id: true, name: true },
} as const

const deliveryPromiseParticipantSelection = {
  id: true,
  ownerType: true,
  owner: {
    on_ProductVariant: {
      id: true,
      sku: true,
      product: { id: true, title: true },
    },
  },
} as const

const parseBool = (value: unknown, flag: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new CliError(`${flag} must be a string`, 2)
  const raw = value.trim().toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  throw new CliError(`${flag} must be true|false`, 2)
}

export const runDeliveryPromises = async ({
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
        '  shop delivery-promises <verb> [flags]',
        '',
        'Verbs:',
        '  get-settings|get-participants|get-provider',
        '  update-participants|upsert-provider',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get-settings') {
    const result = await runQuery(ctx, {
      deliveryPromiseSettings: deliveryPromiseSettingsSelection,
    })
    if (result === undefined) return
    printJson(result.deliveryPromiseSettings, ctx.format !== 'raw')
    return
  }

  if (verb === 'get-provider') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const locationId = requireLocationId((args as any)['location-id'], '--location-id')

    const result = await runQuery(ctx, {
      deliveryPromiseProvider: {
        __args: { locationId },
        ...deliveryPromiseProviderSelection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.deliveryPromiseProvider, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get-participants') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'branded-promise-handle': { type: 'string' },
        'owner-id': { type: 'string', multiple: true },
      },
    })
    const brandedPromiseHandle = (args as any)['branded-promise-handle'] as string | undefined
    if (!brandedPromiseHandle) throw new CliError('Missing --branded-promise-handle', 2)

    const ownerIdsRaw = (args as any)['owner-id'] as string[] | undefined
    const ownerIds = parseStringList(ownerIdsRaw, '--owner-id', { allowEmpty: true }).map((id) =>
      coerceGid(id, 'ProductVariant'),
    )

    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      deliveryPromiseParticipants: {
        __args: {
          brandedPromiseHandle,
          ...(ownerIds.length ? { ownerIds } : {}),
          first,
          after,
          reverse,
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: deliveryPromiseParticipantSelection,
      },
    })
    if (result === undefined) return
    const connection = result.deliveryPromiseParticipants ?? { nodes: [], pageInfo: undefined }
    printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'update-participants') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'branded-promise-handle': { type: 'string' },
        'owners-to-add': { type: 'string', multiple: true },
        'owners-to-remove': { type: 'string', multiple: true },
      },
    })
    const brandedPromiseHandle = (args as any)['branded-promise-handle'] as string | undefined
    if (!brandedPromiseHandle) throw new CliError('Missing --branded-promise-handle', 2)

    const ownersToAdd = parseStringList((args as any)['owners-to-add'], '--owners-to-add', { allowEmpty: true }).map(
      (id) => coerceGid(id, 'ProductVariant'),
    )
    const ownersToRemove = parseStringList(
      (args as any)['owners-to-remove'],
      '--owners-to-remove',
      { allowEmpty: true },
    ).map((id) => coerceGid(id, 'ProductVariant'))

    const result = await runMutation(ctx, {
      deliveryPromiseParticipantsUpdate: {
        __args: {
          brandedPromiseHandle,
          ownersToAdd,
          ownersToRemove,
        },
        promiseParticipants: deliveryPromiseParticipantSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.deliveryPromiseParticipantsUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.deliveryPromiseParticipantsUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'upsert-provider') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        active: { type: 'string' },
        'fulfillment-delay': { type: 'string' },
        'time-zone': { type: 'string' },
      },
    })
    const locationId = requireLocationId((args as any)['location-id'], '--location-id')
    const active = parseBool((args as any).active, '--active')
    const fulfillmentDelayRaw = (args as any)['fulfillment-delay'] as any
    const fulfillmentDelay =
      fulfillmentDelayRaw === undefined ? undefined : parseIntFlag('--fulfillment-delay', fulfillmentDelayRaw)
    const timeZone = (args as any)['time-zone'] as string | undefined

    const result = await runMutation(ctx, {
      deliveryPromiseProviderUpsert: {
        __args: {
          locationId,
          ...(active === undefined ? {} : { active }),
          ...(fulfillmentDelay === undefined ? {} : { fulfillmentDelay }),
          ...(timeZone ? { timeZone } : {}),
        },
        deliveryPromiseProvider: deliveryPromiseProviderSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.deliveryPromiseProviderUpsert,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.deliveryPromiseProviderUpsert?.deliveryPromiseProvider?.id ?? '')
    printJson(result.deliveryPromiseProviderUpsert, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for delivery-promises: ${verb}`, 2)
}

