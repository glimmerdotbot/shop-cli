import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const subscriptionBillingAttemptSummarySelection = {
  id: true,
  createdAt: true,
  ready: true,
  errorCode: true,
  errorMessage: true,
  originTime: true,
} as const

const subscriptionBillingCycleSummarySelection = {
  cycleIndex: true,
  status: true,
  billingAttemptExpectedDate: true,
  cycleStartAt: true,
  cycleEndAt: true,
  skipped: true,
  edited: true,
} as const

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

const requireContractId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --contract-id', 2)
  return coerceGid(value, 'SubscriptionContract')
}

const parseCycleIndex = (value: unknown) => {
  if (value === undefined || value === null || value === '') throw new CliError('Missing --cycle-index', 2)
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new CliError('--cycle-index must be a positive integer', 2)
  return n
}

const parseCycleIndexes = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) throw new CliError('Missing --cycle-indexes', 2)
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new CliError('--cycle-indexes must include at least one index', 2)
  const indexes = parts.map((part) => {
    const n = Number(part)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new CliError(`Invalid cycle index: ${part}`, 2)
    }
    return n
  })
  return indexes
}

export const runSubscriptionBilling = async ({
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
        '  shop subscription-billing <verb> [flags]',
        '',
        'Verbs:',
        '  get-attempt|list-attempts|create-attempt|get-cycle|list-cycles|charge',
        '  bulk-charge|bulk-search|skip-cycle|unskip-cycle|edit-schedule|edit-cycle|delete-edits',
        '',
        'Notes:',
        '  - Use --cycle-index (not --id) for cycle-specific operations.',
        '',
        'Common output flags:',
        '  --format json|jsonl|table|raw',
        '  --quiet',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get-attempt') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'SubscriptionBillingAttempt')

    const result = await runQuery(ctx, {
      subscriptionBillingAttempt: {
        __args: { id },
        ...subscriptionBillingAttemptSummarySelection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.subscriptionBillingAttempt, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list-attempts') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      subscriptionContract: {
        __args: { id: contractId },
        billingAttempts: {
          __args: { first, after, reverse },
          pageInfo: { hasNextPage: true, endCursor: true },
          nodes: subscriptionBillingAttemptSummarySelection,
        },
      },
    })
    if (result === undefined) return
    if (!result.subscriptionContract) throw new CliError('Subscription contract not found', 2)
    printConnection({
      connection: result.subscriptionContract.billingAttempts,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop subscription-billing list-attempts',
        first,
        reverse,
        extraFlags: [{ flag: '--contract-id', value: contractId }],
      },
    })
    return
  }

  if (verb === 'create-attempt') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' } } })
    const subscriptionContractId = requireContractId(args['contract-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      subscriptionBillingAttemptCreate: {
        __args: { subscriptionContractId, subscriptionBillingAttemptInput: built.input },
        subscriptionBillingAttempt: subscriptionBillingAttemptSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionBillingAttemptCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionBillingAttemptCreate?.subscriptionBillingAttempt?.id ?? '')
    printJson(result.subscriptionBillingAttemptCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get-cycle') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' }, 'cycle-index': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const cycleIndex = parseCycleIndex(args['cycle-index'])

    const billingCycleInput = { contractId, selector: { index: cycleIndex } }

    const result = await runQuery(ctx, {
      subscriptionBillingCycle: {
        __args: { billingCycleInput },
        ...subscriptionBillingCycleSummarySelection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.subscriptionBillingCycle, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list-cycles') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const result = await runQuery(ctx, {
      subscriptionBillingCycles: {
        __args: { contractId, first, after, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: subscriptionBillingCycleSummarySelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.subscriptionBillingCycles,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop subscription-billing list-cycles',
        first,
        sort: typeof sortKey === 'string' ? sortKey : undefined,
        reverse,
        extraFlags: [{ flag: '--contract-id', value: contractId }],
      },
    })
    return
  }

  if (verb === 'charge') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' }, 'cycle-index': { type: 'string' } } })
    const subscriptionContractId = requireContractId(args['contract-id'])
    const cycleIndex = parseCycleIndex(args['cycle-index'])

    const result = await runMutation(ctx, {
      subscriptionBillingCycleCharge: {
        __args: { subscriptionContractId, billingCycleSelector: { index: cycleIndex } },
        subscriptionBillingAttempt: subscriptionBillingAttemptSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionBillingCycleCharge, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionBillingCycleCharge?.subscriptionBillingAttempt?.id ?? '')
    printJson(result.subscriptionBillingCycleCharge, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-charge' || verb === 'bulk-search') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const hasDateRange = Boolean((built.input as any)?.billingAttemptExpectedDateRange)
    if (!hasDateRange) {
      if (ctx.dryRun) {
        ;(built.input as any).billingAttemptExpectedDateRange = {
          startDate: '2000-01-01T00:00:00Z',
          endDate: '2000-01-02T00:00:00Z',
        }
      } else {
        throw new CliError('Missing billingAttemptExpectedDateRange in --input/--set', 2)
      }
    }

    const mutationField = verb === 'bulk-charge' ? 'subscriptionBillingCycleBulkCharge' : 'subscriptionBillingCycleBulkSearch'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: built.input,
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

  if (verb === 'skip-cycle' || verb === 'unskip-cycle') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' }, 'cycle-index': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const cycleIndex = parseCycleIndex(args['cycle-index'])
    const billingCycleInput = { contractId, selector: { index: cycleIndex } }
    const mutationField = verb === 'skip-cycle' ? 'subscriptionBillingCycleSkip' : 'subscriptionBillingCycleUnskip'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { billingCycleInput },
        billingCycle: subscriptionBillingCycleSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'edit-schedule') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' }, 'cycle-index': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const cycleIndex = parseCycleIndex(args['cycle-index'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const billingCycleInput = { contractId, selector: { index: cycleIndex } }

    const result = await runMutation(ctx, {
      subscriptionBillingCycleScheduleEdit: {
        __args: { billingCycleInput, input: built.input },
        billingCycle: subscriptionBillingCycleSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionBillingCycleScheduleEdit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return
    printJson(result.subscriptionBillingCycleScheduleEdit, ctx.format !== 'raw')
    return
  }

  if (verb === 'edit-cycle') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' }, 'cycle-index': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const cycleIndex = parseCycleIndex(args['cycle-index'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const billingCycleInput = { contractId, selector: { index: cycleIndex } }

    const editResult = await runMutation(ctx, {
      subscriptionBillingCycleContractEdit: {
        __args: { billingCycleInput },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (editResult === undefined) return
    maybeFailOnUserErrors({ payload: editResult.subscriptionBillingCycleContractEdit, failOnUserErrors: ctx.failOnUserErrors })

    const draftId = editResult.subscriptionBillingCycleContractEdit?.draft?.id
    if (!draftId || !built.used) {
      if (ctx.quiet) return console.log(draftId ?? '')
      printJson(editResult.subscriptionBillingCycleContractEdit, ctx.format !== 'raw')
      return
    }

    const updateResult = await runMutation(ctx, {
      subscriptionDraftUpdate: {
        __args: { draftId, input: built.input },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (updateResult === undefined) return
    maybeFailOnUserErrors({ payload: updateResult.subscriptionDraftUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(updateResult.subscriptionDraftUpdate?.draft?.id ?? '')
    printJson(updateResult.subscriptionDraftUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-edits') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contract-id': { type: 'string' }, 'cycle-indexes': { type: 'string' } } })
    const contractId = requireContractId(args['contract-id'])
    const cycleIndexes = parseCycleIndexes(args['cycle-indexes'])

    const billingCycles: any[] = []

    for (const cycleIndex of cycleIndexes) {
      const billingCycleInput = { contractId, selector: { index: cycleIndex } }
      const result = await runMutation(ctx, {
        subscriptionBillingCycleEditDelete: {
          __args: { billingCycleInput },
          billingCycles: subscriptionBillingCycleSummarySelection,
          userErrors: { field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.subscriptionBillingCycleEditDelete, failOnUserErrors: ctx.failOnUserErrors })
      const cycles = result.subscriptionBillingCycleEditDelete?.billingCycles ?? []
      billingCycles.push(...cycles)
    }

    if (ctx.quiet) return
    printJson({ billingCycles }, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for subscription-billing: ${verb}`, 2)
}
