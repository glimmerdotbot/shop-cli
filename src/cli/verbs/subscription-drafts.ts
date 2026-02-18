import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

const subscriptionDraftSummarySelection = {
  id: true,
  customer: { id: true, displayName: true, email: true },
  currencyCode: true,
  billingPolicy: {
    interval: true,
    intervalCount: true,
  },
  deliveryPolicy: {
    interval: true,
    intervalCount: true,
  },
  lines: {
    __args: { first: 10 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      variantId: true,
    },
  },
} as const

const getSubscriptionDraftSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return subscriptionDraftSummarySelection
  if (view === 'raw') return {} as const
  return subscriptionDraftSummarySelection
}

const requireDraftId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --id', 2)
  return coerceGid(value, 'SubscriptionDraft')
}

const requireLineId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --line-id', 2)
  return coerceGid(value, 'SubscriptionLine')
}

const requireDiscountId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --discount-id', 2)
  return coerceGid(value, 'SubscriptionManualDiscount')
}

export const runSubscriptionDrafts = async ({
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
        '  shop subscription-drafts <verb> [flags]',
        '',
        'Verbs:',
        '  get|commit|update|add-line|update-line|remove-line',
        '  add-discount|update-discount|remove-discount|apply-code',
        '  add-free-shipping|update-free-shipping',
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
    const id = requireDraftId(args.id)
    const selection = resolveSelection({
      resource: 'subscription-drafts',
      typeName: 'SubscriptionDraft',
      view: ctx.view,
      baseSelection: getSubscriptionDraftSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { subscriptionDraft: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.subscriptionDraft, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'commit') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const draftId = requireDraftId(args.id)

    const result = await runMutation(ctx, {
      subscriptionDraftCommit: {
        __args: { draftId },
        contract: { id: true, status: true, nextBillingDate: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftCommit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftCommit?.contract?.id ?? '')
    printJson(result.subscriptionDraftCommit, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const draftId = requireDraftId(args.id)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      subscriptionDraftUpdate: {
        __args: { draftId, input: built.input },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftUpdate?.draft?.id ?? '')
    printJson(result.subscriptionDraftUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-line') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const draftId = requireDraftId(args.id)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      subscriptionDraftLineAdd: {
        __args: { draftId, input: built.input },
        draft: subscriptionDraftSummarySelection,
        lineAdded: { id: true, title: true, quantity: true, variantId: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftLineAdd, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftLineAdd?.draft?.id ?? '')
    printJson(result.subscriptionDraftLineAdd, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-line') {
    const args = parseStandardArgs({ argv, extraOptions: { 'line-id': { type: 'string' } } })
    const draftId = requireDraftId(args.id)
    const lineId = requireLineId(args['line-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      subscriptionDraftLineUpdate: {
        __args: { draftId, lineId, input: built.input },
        draft: subscriptionDraftSummarySelection,
        lineUpdated: { id: true, title: true, quantity: true, variantId: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftLineUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftLineUpdate?.draft?.id ?? '')
    printJson(result.subscriptionDraftLineUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-line') {
    const args = parseStandardArgs({ argv, extraOptions: { 'line-id': { type: 'string' } } })
    const draftId = requireDraftId(args.id)
    const lineId = requireLineId(args['line-id'])

    const result = await runMutation(ctx, {
      subscriptionDraftLineRemove: {
        __args: { draftId, lineId },
        draft: subscriptionDraftSummarySelection,
        lineRemoved: { id: true, title: true, quantity: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftLineRemove, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftLineRemove?.draft?.id ?? '')
    printJson(result.subscriptionDraftLineRemove, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-discount' || verb === 'update-discount') {
    const args = parseStandardArgs({ argv, extraOptions: { 'discount-id': { type: 'string' } } })
    const draftId = requireDraftId(args.id)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const mutationField = verb === 'add-discount' ? 'subscriptionDraftDiscountAdd' : 'subscriptionDraftDiscountUpdate'
    const discountId = verb === 'update-discount' ? requireDiscountId(args['discount-id']) : undefined

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: {
          draftId,
          ...(discountId ? { discountId } : {}),
          input: built.input,
        },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.draft?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-discount') {
    const args = parseStandardArgs({ argv, extraOptions: { 'discount-id': { type: 'string' } } })
    const draftId = requireDraftId(args.id)
    const discountId = requireDiscountId(args['discount-id'])

    const result = await runMutation(ctx, {
      subscriptionDraftDiscountRemove: {
        __args: { draftId, discountId },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftDiscountRemove, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftDiscountRemove?.draft?.id ?? '')
    printJson(result.subscriptionDraftDiscountRemove, ctx.format !== 'raw')
    return
  }

  if (verb === 'apply-code') {
    const args = parseStandardArgs({ argv, extraOptions: { code: { type: 'string' } } })
    const draftId = requireDraftId(args.id)
    const code = args.code as string | undefined
    if (!code) throw new CliError('Missing --code', 2)

    const result = await runMutation(ctx, {
      subscriptionDraftDiscountCodeApply: {
        __args: { draftId, redeemCode: code },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionDraftDiscountCodeApply, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionDraftDiscountCodeApply?.draft?.id ?? '')
    printJson(result.subscriptionDraftDiscountCodeApply, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-free-shipping' || verb === 'update-free-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: { 'discount-id': { type: 'string' } } })
    const draftId = requireDraftId(args.id)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const mutationField =
      verb === 'add-free-shipping'
        ? 'subscriptionDraftFreeShippingDiscountAdd'
        : 'subscriptionDraftFreeShippingDiscountUpdate'

    const discountId = verb === 'update-free-shipping' ? requireDiscountId(args['discount-id']) : undefined

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: {
          draftId,
          ...(discountId ? { discountId } : {}),
          input: built.input,
        },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.draft?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for subscription-drafts: ${verb}`, 2)
}
