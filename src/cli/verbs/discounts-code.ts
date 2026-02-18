import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseFirst, parseIds, requireId } from './_shared'

const codeDiscountNodeSummarySelection = {
  id: true,
  codeDiscount: {
    __typename: true,
    on_DiscountCodeBasic: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      asyncUsageCount: true,
      codes: { __args: { first: 5 }, nodes: { id: true, code: true } },
    },
    on_DiscountCodeBxgy: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      asyncUsageCount: true,
      codes: { __args: { first: 5 }, nodes: { id: true, code: true } },
    },
    on_DiscountCodeFreeShipping: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      asyncUsageCount: true,
      codes: { __args: { first: 5 }, nodes: { id: true, code: true } },
    },
    on_DiscountCodeApp: {
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      usageLimit: true,
      asyncUsageCount: true,
      codes: { __args: { first: 5 }, nodes: { id: true, code: true } },
      appDiscountType: { title: true, functionId: true },
    },
  },
} as const

const codeDiscountNodeFullSelection = {
  ...codeDiscountNodeSummarySelection,
} as const

const codeAppDiscountSummarySelection = {
  discountId: true,
  title: true,
  status: true,
} as const

const getCodeDiscountSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return codeDiscountNodeFullSelection
  if (view === 'raw') return {} as const
  return codeDiscountNodeSummarySelection
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

const parseRedeemCodeInputs = (raw: string[]) => raw.map((code) => ({ code }))
const hasListArg = (value: unknown) => (Array.isArray(value) ? value.length > 0 : value !== undefined)

export const runDiscountsCode = async ({
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
        '  shop discounts-code <verb> [flags]',
        '',
        'Verbs:',
        '  create-basic|create-bxgy|create-free-shipping|create-app',
        '  get|get-by-code|list|count',
        '  update-basic|update-bxgy|update-free-shipping|update-app',
        '  delete|bulk-delete|activate|deactivate|bulk-activate|bulk-deactivate',
        '  add-redeem-codes|delete-redeem-codes',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Notes:',
        '  Destructive operations require --yes.',
        '  add-redeem-codes accepts --codes <code,code,...>.',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountCodeNode')
    const selection = resolveSelection({
      resource: 'discounts-code',
      view: ctx.view,
      baseSelection: getCodeDiscountSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { codeDiscountNode: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.codeDiscountNode, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get-by-code') {
    const args = parseStandardArgs({ argv, extraOptions: { code: { type: 'string' } } })
    const code = args.code as string | undefined
    if (!code) throw new CliError('Missing --code', 2)
    const selection = resolveSelection({
      resource: 'discounts-code',
      view: ctx.view,
      baseSelection: getCodeDiscountSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { codeDiscountNodeByCode: { __args: { code }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.codeDiscountNodeByCode, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'discounts-code',
      view: ctx.view,
      baseSelection: getCodeDiscountSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      codeDiscountNodes: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.codeDiscountNodes, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { discountCodesCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.discountCodesCount?.count ?? '')
    printJson(result.discountCodesCount, ctx.format !== 'raw')
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
      discountCodeBasicCreate: {
        __args: { basicCodeDiscount: built.input },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeBasicCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeBasicCreate?.codeDiscountNode?.id ?? '')
    printJson(result.discountCodeBasicCreate, ctx.format !== 'raw')
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
      discountCodeBxgyCreate: {
        __args: { bxgyCodeDiscount: built.input },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeBxgyCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeBxgyCreate?.codeDiscountNode?.id ?? '')
    printJson(result.discountCodeBxgyCreate, ctx.format !== 'raw')
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
      discountCodeFreeShippingCreate: {
        __args: { freeShippingCodeDiscount: built.input },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeFreeShippingCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeFreeShippingCreate?.codeDiscountNode?.id ?? '')
    printJson(result.discountCodeFreeShippingCreate, ctx.format !== 'raw')
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
      discountCodeAppCreate: {
        __args: { codeAppDiscount: input },
        codeAppDiscount: codeAppDiscountSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeAppCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeAppCreate?.codeAppDiscount?.discountId ?? '')
    printJson(result.discountCodeAppCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-basic') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountCodeNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountCodeBasicUpdate: {
        __args: { id, basicCodeDiscount: built.input },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeBasicUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeBasicUpdate?.codeDiscountNode?.id ?? '')
    printJson(result.discountCodeBasicUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-bxgy') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountCodeNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountCodeBxgyUpdate: {
        __args: { id, bxgyCodeDiscount: built.input },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeBxgyUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeBxgyUpdate?.codeDiscountNode?.id ?? '')
    printJson(result.discountCodeBxgyUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-free-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountCodeNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      discountCodeFreeShippingUpdate: {
        __args: { id, freeShippingCodeDiscount: built.input },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeFreeShippingUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeFreeShippingUpdate?.codeDiscountNode?.id ?? '')
    printJson(result.discountCodeFreeShippingUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-app') {
    const args = parseStandardArgs({ argv, extraOptions: { 'function-id': { type: 'string' } } })
    const id = requireId(args.id, 'DiscountCodeNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = applyFunctionId(built.input, args['function-id'] as any)

    const result = await runMutation(ctx, {
      discountCodeAppUpdate: {
        __args: { id, codeAppDiscount: input },
        codeAppDiscount: codeAppDiscountSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeAppUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeAppUpdate?.codeAppDiscount?.discountId ?? '')
    printJson(result.discountCodeAppUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountCodeNode')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      discountCodeDelete: {
        __args: { id },
        deletedCodeDiscountId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeDelete?.deletedCodeDiscountId ?? '')
    printJson(result.discountCodeDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({ argv, extraOptions: { ids: { type: 'string', multiple: true } } })
    if (!args.yes) throw new CliError('Refusing to bulk-delete without --yes', 2)
    const rawIds = (args as any).ids
    const ids = hasListArg(rawIds) ? parseIds(rawIds, 'DiscountCodeNode') : undefined
    const search = (args as any).query as string | undefined

    if ((!ids || ids.length === 0) && !search) {
      throw new CliError('Missing --ids or --query for bulk-delete', 2)
    }

    const result = await runMutation(ctx, {
      discountCodeBulkDelete: {
        __args: { ...(ids ? { ids } : {}), ...(search ? { search } : {}) },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountCodeBulkDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountCodeBulkDelete?.job?.id ?? '')
    printJson(result.discountCodeBulkDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'activate' || verb === 'deactivate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DiscountCodeNode')
    const mutationField = verb === 'activate' ? 'discountCodeActivate' : 'discountCodeDeactivate'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { id },
        codeDiscountNode: codeDiscountNodeSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.codeDiscountNode?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-activate' || verb === 'bulk-deactivate') {
    const args = parseStandardArgs({ argv, extraOptions: { ids: { type: 'string', multiple: true } } })
    const rawIds = (args as any).ids
    const ids = hasListArg(rawIds) ? parseIds(rawIds, 'DiscountCodeNode') : undefined
    const search = (args as any).query as string | undefined

    if ((!ids || ids.length === 0) && !search) {
      throw new CliError('Missing --ids or --query for bulk operation', 2)
    }

    const mutationField = verb === 'bulk-activate' ? 'discountCodeBulkActivate' : 'discountCodeBulkDeactivate'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { ...(ids ? { ids } : {}), ...(search ? { search } : {}) },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.job?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-redeem-codes') {
    const args = parseStandardArgs({ argv, extraOptions: { codes: { type: 'string' } } })
    const discountId = requireId(args.id, 'DiscountCodeNode')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    let codes: Array<{ code: string }> | undefined
    if (typeof args.codes === 'string') {
      codes = parseRedeemCodeInputs(parseCsv(args.codes, '--codes'))
    } else if (built.used) {
      if (Array.isArray(built.input)) {
        codes = built.input.map((c) => (typeof c === 'string' ? { code: c } : c))
      } else if (Array.isArray(built.input?.codes)) {
        codes = built.input.codes.map((c: any) => (typeof c === 'string' ? { code: c } : c))
      }
    }

    if (!codes || codes.length === 0) throw new CliError('Missing --codes or input codes array', 2)

    const result = await runMutation(ctx, {
      discountRedeemCodeBulkAdd: {
        __args: { discountId, codes },
        bulkCreation: { id: true, done: true, codesCount: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.discountRedeemCodeBulkAdd, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.discountRedeemCodeBulkAdd?.bulkCreation?.id ?? '')
    printJson(result.discountRedeemCodeBulkAdd, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-redeem-codes') {
    const args = parseStandardArgs({ argv, extraOptions: { ids: { type: 'string', multiple: true } } })
    const discountId = requireId(args.id, 'DiscountCodeNode')
    if (!args.yes) throw new CliError('Refusing to delete redeem codes without --yes', 2)
    const rawIds = (args as any).ids
    const ids = hasListArg(rawIds) ? parseIds(rawIds, 'DiscountRedeemCode') : undefined
    const search = (args as any).query as string | undefined

    if ((!ids || ids.length === 0) && !search) {
      throw new CliError('Missing --ids or --query for delete-redeem-codes', 2)
    }

    const result = await runMutation(ctx, {
      discountCodeRedeemCodeBulkDelete: {
        __args: { discountId, ...(ids ? { ids } : {}), ...(search ? { search } : {}) },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.discountCodeRedeemCodeBulkDelete,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.discountCodeRedeemCodeBulkDelete?.job?.id ?? '')
    printJson(result.discountCodeRedeemCodeBulkDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for discounts-code: ${verb}`, 2)
}
