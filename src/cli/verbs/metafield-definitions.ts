import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const metafieldDefinitionSummarySelection = {
  id: true,
  name: true,
  namespace: true,
  key: true,
  ownerType: true,
  type: { name: true, category: true },
} as const

const metafieldDefinitionFullSelection = {
  ...metafieldDefinitionSummarySelection,
} as const

const getMetafieldDefinitionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return metafieldDefinitionFullSelection
  if (view === 'raw') return {} as const
  return metafieldDefinitionSummarySelection
}

export const runMetafieldDefinitions = async ({
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
        '  shop metafield-definitions <verb> [flags]',
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
    const id = requireId(args.id, 'MetafieldDefinition')
    const selection = resolveSelection({
      resource: 'metafield-definitions',
      view: ctx.view,
      baseSelection: getMetafieldDefinitionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { metafieldDefinition: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.metafieldDefinition, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'owner-type': { type: 'string' } },
    })
    const ownerType = (args as any)['owner-type'] as string | undefined
    if (!ownerType) throw new CliError('Missing --owner-type (e.g. PRODUCT)', 2)

    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'metafield-definitions',
      view: ctx.view,
      baseSelection: getMetafieldDefinitionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      metafieldDefinitions: {
        __args: { ownerType, first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.metafieldDefinitions,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('metafield-definitions', { first, query, sort: sortKey, reverse }),
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
      metafieldDefinitionCreate: {
        __args: { definition: built.input },
        createdDefinition: metafieldDefinitionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.metafieldDefinitionCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.metafieldDefinitionCreate?.createdDefinition?.id ?? '')
    printJson(result.metafieldDefinitionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { key: { type: 'string' }, namespace: { type: 'string' }, 'owner-type': { type: 'string' } },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    let key = (args as any).key as string | undefined
    let namespace = (args as any).namespace as string | undefined
    let ownerType = (args as any)['owner-type'] as string | undefined

    const id = (args as any).id as string | undefined
    if (id) {
      const resolved = await runQuery(ctx, {
        metafieldDefinition: {
          __args: { id: requireId(id, 'MetafieldDefinition') },
          key: true,
          namespace: true,
          ownerType: true,
        },
      })
      if (resolved === undefined) return
      if (!resolved.metafieldDefinition) throw new CliError('MetafieldDefinition not found for --id', 2)
      key = resolved.metafieldDefinition.key
      namespace = resolved.metafieldDefinition.namespace
      ownerType = resolved.metafieldDefinition.ownerType as any
    }

    key ??= built.input?.key
    namespace ??= built.input?.namespace
    ownerType ??= built.input?.ownerType

    if (!key) throw new CliError('Missing identifier key (pass --key, or include key in --input, or pass --id)', 2)
    if (!ownerType) {
      throw new CliError('Missing identifier ownerType (pass --owner-type, or include ownerType in --input, or pass --id)', 2)
    }

    const definition = {
      ...built.input,
      key,
      ownerType,
      ...(namespace === undefined ? {} : { namespace }),
    }

    const result = await runMutation(ctx, {
      metafieldDefinitionUpdate: {
        __args: { definition },
        updatedDefinition: metafieldDefinitionSummarySelection,
        userErrors: { field: true, message: true },
        validationJob: { id: true, done: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.metafieldDefinitionUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.metafieldDefinitionUpdate?.updatedDefinition?.id ?? '')
    printJson(result.metafieldDefinitionUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MetafieldDefinition')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const extra = buildInput({
      inputArg: undefined,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const result = await runMutation(ctx, {
      metafieldDefinitionDelete: {
        __args: { id, ...(extra.used ? extra.input : {}) },
        deletedDefinitionId: true,
        deletedDefinition: { namespace: true, key: true, ownerType: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.metafieldDefinitionDelete,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.metafieldDefinitionDelete?.deletedDefinitionId ?? '')
    printJson(result.metafieldDefinitionDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for metafield-definitions: ${verb}`, 2)
}
