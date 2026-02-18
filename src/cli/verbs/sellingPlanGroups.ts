import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIds, requireId } from './_shared'

const sellingPlanGroupSummarySelection = {
  id: true,
  name: true,
  merchantCode: true,
  createdAt: true,
} as const

const getSellingPlanGroupSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return sellingPlanGroupSummarySelection
}

export const runSellingPlanGroups = async ({
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
        '  shop selling-plan-groups <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|add-variants|remove-variants',
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
    const id = requireId(args.id, 'SellingPlanGroup')
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getSellingPlanGroupSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { sellingPlanGroup: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.sellingPlanGroup, format: ctx.format, quiet: ctx.quiet })
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
      view: ctx.view,
      baseSelection: getSellingPlanGroupSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      sellingPlanGroups: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.sellingPlanGroups, format: ctx.format, quiet: ctx.quiet })
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
      sellingPlanGroupCreate: {
        __args: { input: built.input },
        sellingPlanGroup: sellingPlanGroupSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.sellingPlanGroupCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.sellingPlanGroupCreate?.sellingPlanGroup?.id ?? '')
    if (ctx.format === 'raw') printJson(result.sellingPlanGroupCreate, false)
    else printJson(result.sellingPlanGroupCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'SellingPlanGroup')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      sellingPlanGroupUpdate: {
        __args: { id, input: built.input },
        sellingPlanGroup: sellingPlanGroupSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.sellingPlanGroupUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.sellingPlanGroupUpdate?.sellingPlanGroup?.id ?? '')
    if (ctx.format === 'raw') printJson(result.sellingPlanGroupUpdate, false)
    else printJson(result.sellingPlanGroupUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'SellingPlanGroup')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      sellingPlanGroupDelete: {
        __args: { id },
        deletedSellingPlanGroupId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.sellingPlanGroupDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.sellingPlanGroupDelete?.deletedSellingPlanGroupId ?? '')
    if (ctx.format === 'raw') printJson(result.sellingPlanGroupDelete, false)
    else printJson(result.sellingPlanGroupDelete)
    return
  }

  if (verb === 'add-variants' || verb === 'remove-variants') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'variant-ids': { type: 'string', multiple: true } },
    })
    const id = requireId(args.id, 'SellingPlanGroup')
    const variantIds = parseIds((args as any)['variant-ids'], 'ProductVariant')

    const mutationField =
      verb === 'add-variants'
        ? 'sellingPlanGroupAddProductVariants'
        : 'sellingPlanGroupRemoveProductVariants'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { id, productVariantIds: variantIds },
        sellingPlanGroup: sellingPlanGroupSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.sellingPlanGroup?.id ?? '')
    if (ctx.format === 'raw') printJson(payload, false)
    else printJson(payload)
    return
  }

  throw new CliError(`Unknown verb for selling-plan-groups: ${verb}`, 2)
}
