import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIds, requireId } from './_shared'

const parseBool = (flag: string, value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) throw new CliError(`Missing ${flag}`, 2)
  const v = value.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  throw new CliError(`${flag} must be true|false`, 2)
}

const paymentCustomizationSummarySelection = {
  id: true,
  enabled: true,
  functionId: true,
} as const

const paymentCustomizationFullSelection = {
  ...paymentCustomizationSummarySelection,
  errorHistory: true,
} as const

const getPaymentCustomizationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return paymentCustomizationFullSelection
  if (view === 'raw') return {} as const
  return paymentCustomizationSummarySelection
}

export const runPaymentCustomizations = async ({
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
    const id = requireId(args.id, 'PaymentCustomization')

    const selection = resolveSelection({
      resource: 'payment-customizations',
      view: ctx.view,
      baseSelection: getPaymentCustomizationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { paymentCustomization: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.paymentCustomization, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'payment-customizations',
      view: ctx.view,
      baseSelection: getPaymentCustomizationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      paymentCustomizations: {
        __args: { first, after, query, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.paymentCustomizations, format: ctx.format, quiet: ctx.quiet })
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
      paymentCustomizationCreate: {
        __args: { paymentCustomization: built.input },
        paymentCustomization: paymentCustomizationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentCustomizationCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.paymentCustomizationCreate?.paymentCustomization?.id ?? '')
    printJson(result.paymentCustomizationCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PaymentCustomization')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      paymentCustomizationUpdate: {
        __args: { id, paymentCustomization: built.input },
        paymentCustomization: paymentCustomizationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentCustomizationUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.paymentCustomizationUpdate?.paymentCustomization?.id ?? '')
    printJson(result.paymentCustomizationUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PaymentCustomization')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      paymentCustomizationDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentCustomizationDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.paymentCustomizationDelete?.deletedId ?? '')
    printJson(result.paymentCustomizationDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-enabled') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        enabled: { type: 'string' },
      },
    })
    const enabled = parseBool('--enabled', (args as any).enabled)
    const ids = parseIds(args.ids as any, 'PaymentCustomization')

    const result = await runMutation(ctx, {
      paymentCustomizationActivation: {
        __args: { enabled, ids },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentCustomizationActivation, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return
    printJson(result.paymentCustomizationActivation, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for payment-customizations: ${verb}`, 2)
}
