import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseIds, requireId } from './_shared'

const automaticDiscountNodeSummarySelection = {
  id: true,
  automaticDiscount: {
    __typename: true,
    on_DiscountAutomaticBasic: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      combinesWith: { orderDiscounts: true, productDiscounts: true, shippingDiscounts: true },
      asyncUsageCount: true,
      customerGets: {
        value: {
          __typename: true,
          on_DiscountPercentage: { percentage: true },
          on_DiscountAmount: { amount: { amount: true, currencyCode: true } },
          on_DiscountOnQuantity: {
            quantity: { quantity: true },
            effect: {
              __typename: true,
              on_DiscountPercentage: { percentage: true },
              on_DiscountAmount: { amount: { amount: true, currencyCode: true } },
            },
          },
        },
      },
    },
    on_DiscountAutomaticBxgy: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usesPerOrderLimit: true,
    },
    on_DiscountAutomaticFreeShipping: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
    on_DiscountAutomaticApp: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      appDiscountType: { title: true, functionId: true },
    },
  },
} as const

const automaticDiscountNodeFullSelection = {
  ...automaticDiscountNodeSummarySelection,
} as const

const automaticAppDiscountIdSelection = {
  discountId: true,
} as const

const automaticDiscountSummarySelection = {
  __typename: true,
  on_Node: { id: true },
  on_DiscountAutomaticBasic: { title: true, status: true, startsAt: true, endsAt: true },
  on_DiscountAutomaticBxgy: { title: true, status: true, startsAt: true, endsAt: true, usesPerOrderLimit: true },
  on_DiscountAutomaticFreeShipping: { title: true, status: true, startsAt: true, endsAt: true },
  on_DiscountAutomaticApp: { title: true, status: true, startsAt: true, endsAt: true, appDiscountType: { title: true, functionId: true } },
} as const

const getAutomaticDiscountSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return automaticDiscountNodeFullSelection
  if (view === 'raw') return {} as const
  return automaticDiscountNodeSummarySelection
}

const applyFunctionId = (input: any, functionId?: string) => {
  if (!functionId) return input
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    if (input.functionId === undefined && input.functionHandle === undefined) {
      return { ...input, functionId }
    }
  }
  return input
}

const hasListArg = (value: unknown) => (Array.isArray(value) ? value.length > 0 : value !== undefined)

export const runDiscountsAutomatic = async ({
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
        '  shop discounts-automatic <verb> [flags]',
        '',
        'Verbs:',
        '  create-basic|create-bxgy|create-free-shipping|create-app',
        '  get|list',
        '  update-basic|update-bxgy|update-free-shipping|update-app',
        '  delete|bulk-delete|activate|deactivate',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Notes:',
        '  Destructive operations require --yes.',
        '  create-app/update-app accept --function-id to set the function reference.',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    const selection = resolveSelection({
      resource: 'discounts-automatic',
      view: ctx.view,
      baseSelection: getAutomaticDiscountSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { automaticDiscountNode: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.automaticDiscountNode, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'discounts-automatic',
      view: ctx.view,
      baseSelection: getAutomaticDiscountSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      automaticDiscountNodes: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.automaticDiscountNodes,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('discounts-automatic', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'get-discount') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')

    const result = await runQuery(ctx, {
      automaticDiscount: {
        __args: { id },
        ...automaticDiscountSummarySelection,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log((result.automaticDiscount as any)?.id ?? '')
    printJson(result.automaticDiscount, ctx.format !== 'raw')
    return
  }

  if (verb === 'list-discounts') {
    const args = parseStandardArgs({ argv, extraOptions: { 'saved-search-id': { type: 'string' } } })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const savedSearchId = (args as any)['saved-search-id'] as any

    const result = await runQuery(ctx, {
      automaticDiscounts: {
        __args: { first, after, query, reverse, sortKey, ...(savedSearchId ? { savedSearchId } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: automaticDiscountSummarySelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.automaticDiscounts,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'discounts-automatic',
        { first, query, sort: sortKey, reverse },
        savedSearchId ? [{ flag: '--saved-search-id', value: savedSearchId }] : undefined,
      ),
    })
    return
  }

  if (verb === 'create-basic') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountAutomaticBasicCreate: {
        __args: { automaticBasicDiscount: built.input },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticBasicCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountAutomaticBasicCreate?.automaticDiscountNode?.id ?? '')
    printJson(result.discountAutomaticBasicCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-bxgy') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountAutomaticBxgyCreate: {
        __args: { automaticBxgyDiscount: built.input },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticBxgyCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountAutomaticBxgyCreate?.automaticDiscountNode?.id ?? '')
    printJson(result.discountAutomaticBxgyCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-free-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountAutomaticFreeShippingCreate: {
        __args: { freeShippingAutomaticDiscount: built.input },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.discountAutomaticFreeShippingCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id ?? '')
    printJson(result.discountAutomaticFreeShippingCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-app') {
    const args = parseStandardArgs({ argv, extraOptions: { 'function-id': { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = applyFunctionId(built.input, args['function-id'] as any)

    const result = await runMutation(ctx, {
      discountAutomaticAppCreate: {
        __args: { automaticAppDiscount: input },
        automaticAppDiscount: automaticAppDiscountIdSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticAppCreate, failOnUserErrors: ctx.failOnUserErrors })
    const discountId = result.discountAutomaticAppCreate?.automaticAppDiscount?.discountId ?? null

    if (ctx.quiet) return console.log(discountId ?? '')

    if (discountId === null) {
      printJson(
        { automaticDiscountNode: null, userErrors: result.discountAutomaticAppCreate?.userErrors ?? [] },
        ctx.format !== 'raw',
      )
      return
    }

    const nodeResult = await runQuery(ctx, {
      automaticDiscountNode: {
        __args: { id: discountId },
        ...automaticDiscountNodeSummarySelection,
      },
    })

    if (nodeResult === undefined) return

    printJson(
      { automaticDiscountNode: nodeResult.automaticDiscountNode ?? null, userErrors: result.discountAutomaticAppCreate?.userErrors ?? [] },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'update-basic') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountAutomaticBasicUpdate: {
        __args: { id, automaticBasicDiscount: built.input },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticBasicUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountAutomaticBasicUpdate?.automaticDiscountNode?.id ?? '')
    printJson(result.discountAutomaticBasicUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-bxgy') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountAutomaticBxgyUpdate: {
        __args: { id, automaticBxgyDiscount: built.input },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticBxgyUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountAutomaticBxgyUpdate?.automaticDiscountNode?.id ?? '')
    printJson(result.discountAutomaticBxgyUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-free-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountAutomaticFreeShippingUpdate: {
        __args: { id, freeShippingAutomaticDiscount: built.input },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.discountAutomaticFreeShippingUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.discountAutomaticFreeShippingUpdate?.automaticDiscountNode?.id ?? '')
    printJson(result.discountAutomaticFreeShippingUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-app') {
    const args = parseStandardArgs({ argv, extraOptions: { 'function-id': { type: 'string' } } })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = applyFunctionId(built.input, args['function-id'] as any)

    const result = await runMutation(ctx, {
      discountAutomaticAppUpdate: {
        __args: { id, automaticAppDiscount: input },
        automaticAppDiscount: automaticAppDiscountIdSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticAppUpdate, failOnUserErrors: ctx.failOnUserErrors })

    if (ctx.quiet) return console.log(id ?? '')

    const nodeResult = await runQuery(ctx, {
      automaticDiscountNode: { __args: { id }, ...automaticDiscountNodeSummarySelection },
    })
    if (nodeResult === undefined) return

    printJson(
      {
        automaticDiscountNode: nodeResult.automaticDiscountNode ?? null,
        userErrors: result.discountAutomaticAppUpdate?.userErrors ?? [],
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      discountAutomaticDelete: {
        __args: { id },
        deletedAutomaticDiscountId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountAutomaticDelete?.deletedAutomaticDiscountId ?? '')
    printJson(result.discountAutomaticDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({ argv, extraOptions: { ids: { type: 'string', multiple: true } } })
    if (!args.yes) throw new CliError('Refusing to bulk-delete without --yes', 2)
    const rawIds = (args as any).ids
    const ids = hasListArg(rawIds) ? parseIds(rawIds, 'DiscountAutomaticNode') : undefined
    const search = (args as any).query as string | undefined

    if ((!ids || ids.length === 0) && !search) {
      throw new CliError('Missing --ids or --query for bulk-delete', 2)
    }

    const result = await runMutation(ctx, {
      discountAutomaticBulkDelete: {
        __args: { ...(ids ? { ids } : {}), ...(search ? { search } : {}) },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountAutomaticBulkDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountAutomaticBulkDelete?.job?.id ?? '')
    printJson(result.discountAutomaticBulkDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'activate' || verb === 'deactivate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountAutomaticNode')
    const mutationField = verb === 'activate' ? 'discountAutomaticActivate' : 'discountAutomaticDeactivate'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { id },
        automaticDiscountNode: automaticDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.automaticDiscountNode?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for discounts-automatic: ${verb}`, 2)
}
