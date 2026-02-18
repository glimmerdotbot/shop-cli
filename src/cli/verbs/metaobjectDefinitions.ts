import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

const metaobjectDefinitionSummarySelection = {
  id: true,
  name: true,
  type: true,
} as const

const getMetaobjectDefinitionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  return metaobjectDefinitionSummarySelection
}

export const runMetaobjectDefinitions = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MetaobjectDefinition')
    const selection = applySelect(getMetaobjectDefinitionSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { metaobjectDefinition: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.metaobjectDefinition?.id ?? '')
    printJson(result.metaobjectDefinition)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = applySelect(getMetaobjectDefinitionSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      metaobjectDefinitions: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.metaobjectDefinitions, format: ctx.format, quiet: ctx.quiet })
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
      metaobjectDefinitionCreate: {
        __args: { definition: built.input },
        metaobjectDefinition: metaobjectDefinitionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metaobjectDefinitionCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metaobjectDefinitionCreate?.metaobjectDefinition?.id ?? '')
    printJson(result.metaobjectDefinitionCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MetaobjectDefinition')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      metaobjectDefinitionUpdate: {
        __args: { id, definition: built.input },
        metaobjectDefinition: metaobjectDefinitionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metaobjectDefinitionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metaobjectDefinitionUpdate?.metaobjectDefinition?.id ?? '')
    printJson(result.metaobjectDefinitionUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MetaobjectDefinition')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      metaobjectDefinitionDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metaobjectDefinitionDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metaobjectDefinitionDelete?.deletedId ?? '')
    printJson(result.metaobjectDefinitionDelete)
    return
  }

  throw new CliError(`Unknown verb for metaobject-definitions: ${verb}`, 2)
}

