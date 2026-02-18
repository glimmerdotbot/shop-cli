import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const carrierServiceSelection = {
  id: true,
  name: true,
  active: true,
  callbackUrl: true,
  supportsServiceDiscovery: true,
  formattedName: true,
} as const

const getCarrierServiceSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return carrierServiceSelection
}

export const runCarrierServices = async ({
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
        '  shop carrier-services <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|list-available|update|delete',
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
    const id = requireId(args.id, 'DeliveryCarrierService')
    const selection = resolveSelection({
      resource: 'carrier-services',
      view: ctx.view,
      baseSelection: getCarrierServiceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, { carrierService: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.carrierService, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'carrier-services',
      view: ctx.view,
      baseSelection: getCarrierServiceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      carrierServices: {
        __args: { first, after, query, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.carrierServices, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list-available') {
    const result = await runQuery(ctx, {
      availableCarrierServices: {
        carrierService: {
          id: true,
          name: true,
          active: true,
          callbackUrl: true,
        },
        locations: { id: true, name: true },
      },
    })
    if (result === undefined) return
    printJson(result.availableCarrierServices, ctx.format !== 'raw')
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
      carrierServiceCreate: {
        __args: { input: built.input },
        carrierService: carrierServiceSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.carrierServiceCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.carrierServiceCreate?.carrierService?.id ?? '')
    printJson(result.carrierServiceCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      carrierServiceUpdate: {
        __args: { input: built.input },
        carrierService: carrierServiceSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.carrierServiceUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.carrierServiceUpdate?.carrierService?.id ?? '')
    printJson(result.carrierServiceUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DeliveryCarrierService')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      carrierServiceDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.carrierServiceDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.carrierServiceDelete?.deletedId ?? '')
    printJson(result.carrierServiceDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for carrier-services: ${verb}`, 2)
}
