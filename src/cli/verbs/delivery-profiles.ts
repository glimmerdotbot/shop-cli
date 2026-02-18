import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const deliveryProfileSummarySelection = {
  id: true,
  name: true,
  default: true,
  activeMethodDefinitionsCount: true,
  originLocationCount: true,
  productVariantsCount: { count: true, precision: true },
} as const

const deliveryProfileFullSelection = {
  ...deliveryProfileSummarySelection,
  profileLocationGroups: {
    locationGroup: {
      id: true,
      locations: { __args: { first: 10 }, nodes: { id: true, name: true } },
    },
    locationGroupZones: {
      __args: { first: 10 },
      nodes: {
        zone: { id: true, name: true, countries: { code: true, name: true } },
        methodDefinitions: {
          __args: { first: 10 },
          nodes: {
            id: true,
            name: true,
            active: true,
            rateProvider: {
              on_DeliveryRateDefinition: { price: { amount: true } },
              on_DeliveryParticipant: { participantServices: { name: true } },
            },
          },
        },
      },
    },
  },
} as const

const getDeliveryProfileSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return deliveryProfileFullSelection
  if (view === 'raw') return {} as const
  return deliveryProfileSummarySelection
}

export const runDeliveryProfiles = async ({
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
        '  shop delivery-profiles <verb> [flags]',
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
    const id = requireId(args.id, 'DeliveryProfile')
    const selection = resolveSelection({
      resource: 'delivery-profiles',
      view: ctx.view,
      baseSelection: getDeliveryProfileSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { deliveryProfile: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.deliveryProfile, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'delivery-profiles',
      view: ctx.view,
      baseSelection: getDeliveryProfileSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      deliveryProfiles: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.deliveryProfiles,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('delivery-profiles', { first, reverse }),
    })
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
      deliveryProfileCreate: {
        __args: { profile: built.input },
        profile: deliveryProfileSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliveryProfileCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.deliveryProfileCreate?.profile?.id ?? '')
    printJson(result.deliveryProfileCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DeliveryProfile')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      deliveryProfileUpdate: {
        __args: { id, profile: built.input },
        profile: deliveryProfileSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliveryProfileUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.deliveryProfileUpdate?.profile?.id ?? '')
    printJson(result.deliveryProfileUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DeliveryProfile')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      deliveryProfileRemove: {
        __args: { id },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliveryProfileRemove, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.deliveryProfileRemove?.job?.id ?? '')
    printJson(result.deliveryProfileRemove, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for delivery-profiles: ${verb}`, 2)
}
