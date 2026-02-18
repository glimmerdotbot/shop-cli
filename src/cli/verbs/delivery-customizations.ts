import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseStringList, requireId } from './_shared'

const deliveryCustomizationSelection = {
  id: true,
  title: true,
  enabled: true,
  functionId: true,
  shopifyFunction: { id: true, title: true, apiType: true },
  metafields: {
    __args: { first: 5 },
    nodes: { namespace: true, key: true, value: true },
  },
} as const

const getDeliveryCustomizationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return deliveryCustomizationSelection
}

export const runDeliveryCustomizations = async ({
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
        '  shop delivery-customizations <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|activate',
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
    const id = requireId(args.id, 'DeliveryCustomization')
    const selection = resolveSelection({
      resource: 'delivery-customizations',
      view: ctx.view,
      baseSelection: getDeliveryCustomizationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { deliveryCustomization: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.deliveryCustomization, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'delivery-customizations',
      view: ctx.view,
      baseSelection: getDeliveryCustomizationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      deliveryCustomizations: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.deliveryCustomizations,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('delivery-customizations', { first, reverse }),
    })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'function-id': { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    if (args['function-id'] && built.input && !built.input.functionId) {
      built.input.functionId = args['function-id']
    }

    const result = await runMutation(ctx, {
      deliveryCustomizationCreate: {
        __args: { deliveryCustomization: built.input },
        deliveryCustomization: deliveryCustomizationSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliveryCustomizationCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.deliveryCustomizationCreate?.deliveryCustomization?.id ?? '')
    printJson(result.deliveryCustomizationCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DeliveryCustomization')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      deliveryCustomizationUpdate: {
        __args: { id, deliveryCustomization: built.input },
        deliveryCustomization: deliveryCustomizationSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliveryCustomizationUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.deliveryCustomizationUpdate?.deliveryCustomization?.id ?? '')
    printJson(result.deliveryCustomizationUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DeliveryCustomization')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      deliveryCustomizationDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliveryCustomizationDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.deliveryCustomizationDelete?.deletedId ?? '')
    printJson(result.deliveryCustomizationDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'activate') {
    const args = parseStandardArgs({ argv, extraOptions: { enabled: { type: 'boolean' } } })
    const enabled = args.enabled
    if (enabled === undefined) throw new CliError('Missing --enabled', 2)
    const ids = parseStringList(args.ids, '--ids')

    const result = await runMutation(ctx, {
      deliveryCustomizationActivation: {
        __args: { enabled: Boolean(enabled), ids },
        ids: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.deliveryCustomizationActivation,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.deliveryCustomizationActivation, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for delivery-customizations: ${verb}`, 2)
}
