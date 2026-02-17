import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

const customerSummarySelection = {
  id: true,
  displayName: true,
  email: true,
  state: true,
  updatedAt: true,
} as const

const customerFullSelection = {
  ...customerSummarySelection,
  createdAt: true,
  phone: true,
  tags: true,
} as const

const getCustomerSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return customerFullSelection
  return customerSummarySelection
}

const requireId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --id', 2)
  return coerceGid(id, 'Customer')
}

const parseFirst = (value: unknown) => {
  if (value === undefined) return 50
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new CliError('--first must be a positive integer', 2)
  return Math.floor(n)
}

const applySelect = (selection: any, select: unknown) => {
  if (!Array.isArray(select) || select.length === 0) return selection
  if (select.some((s) => typeof s !== 'string' || s.includes('.'))) {
    throw new CliError('--select currently only supports top-level fields (no dots)', 2)
  }
  const next = { ...selection }
  for (const field of select as string[]) next[field] = true
  return next
}

export const runCustomers = async ({
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
    const id = requireId(args.id as any)
    const selection = applySelect(getCustomerSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { customer: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.customer?.id ?? '')
    printJson(result.customer)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getCustomerSelection(ctx.view), args.select)

    const result = await runQuery(ctx, {
      customers: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({ connection: result.customers, format: ctx.format, quiet: ctx.quiet })
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
      customerCreate: {
        __args: { input: built.input },
        customer: customerSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerCreate?.customer?.id ?? '')
    printJson(result.customerCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }
    const result = await runMutation(ctx, {
      customerUpdate: {
        __args: { input },
        customer: customerSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerUpdate?.customer?.id ?? '')
    printJson(result.customerUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      customerDelete: {
        __args: { input: { id } },
        deletedCustomerId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerDelete?.deletedCustomerId ?? '')
    printJson(result.customerDelete)
    return
  }

  throw new CliError(`Unknown verb for customers: ${verb}`, 2)
}

