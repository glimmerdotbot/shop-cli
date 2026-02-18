import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseCsv, parseFirst, parseJsonArg, requireId } from './_shared'

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
  if (view === 'raw') return {} as const
  return customerSummarySelection
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
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop customers <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete',
        '  add-tags|remove-tags|merge|send-invite',
        '  metafields upsert',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const query = args.query as any
    const limitRaw = args.limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      customersCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.customersCount?.count ?? '')
    printJson(result.customersCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'metafields upsert') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const ownerId = requireId(args.id as any, 'Customer')

    const asArray = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (value && Array.isArray(value.metafields)) return value.metafields
      if (value && typeof value === 'object') return [value]
      return []
    }

    const items = asArray(built.input)
    if (items.length === 0) throw new CliError('Missing metafield input: pass --input/--set/--set-json', 2)

    const normalized = items.map((m) => {
      if (!m || typeof m !== 'object') throw new CliError('Metafield inputs must be objects', 2)
      const { key, namespace, type, value, compareDigest } = m as any
      if (!key) throw new CliError('Metafield input missing key', 2)
      if (value === undefined) throw new CliError('Metafield input missing value', 2)
      return {
        ownerId,
        key,
        namespace,
        type,
        value: String(value),
        compareDigest,
      }
    })

    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = []
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
      return out
    }

    const payloads: any[] = []
    const ids: Array<string | undefined> = []

    for (const group of chunk(normalized, 25)) {
      const result = await runMutation(ctx, {
        metafieldsSet: {
          __args: { metafields: group },
          metafields: { id: true },
          userErrors: { field: true, message: true, elementIndex: true, code: true },
        },
      })
      if (result === undefined) return

      maybeFailOnUserErrors({ payload: result.metafieldsSet, failOnUserErrors: ctx.failOnUserErrors })
      payloads.push(result.metafieldsSet)
      for (const mf of result.metafieldsSet?.metafields ?? []) ids.push(mf?.id)
    }

    if (ctx.quiet) {
      printIds(ids)
      return
    }

    printJson(payloads.length === 1 ? payloads[0] : payloads, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Customer')
    const selection = resolveSelection({
      resource: 'customers',
      view: ctx.view,
      baseSelection: getCustomerSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { customer: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.customer, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'customers',
      view: ctx.view,
      baseSelection: getCustomerSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      customers: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.customers,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('customers', { first, query, sort: sortKey, reverse }),
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
      customerCreate: {
        __args: { input: built.input },
        customer: customerSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerCreate?.customer?.id ?? '')
    printJson(result.customerCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-tags' || verb === 'remove-tags') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Customer')
    const tags = parseCsv(args.tags as any, '--tags')

    const mutationField = verb === 'add-tags' ? 'tagsAdd' : 'tagsRemove'
    const request: any = {
      [mutationField]: {
        __args: { id, tags },
        node: { id: true },
        userErrors: { field: true, message: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.node?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'merge') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'other-id': { type: 'string' },
        'override-fields': { type: 'string' },
      },
    })
    const customerOneId = requireId(args.id as any, 'Customer')
    const other = (args as any)['other-id'] as string | undefined
    if (!other) throw new CliError('Missing --other-id', 2)
    const customerTwoId = requireId(other, 'Customer')
    const overrideFieldsRaw = (args as any)['override-fields'] as any
    const overrideFields =
      overrideFieldsRaw !== undefined ? parseJsonArg(overrideFieldsRaw, '--override-fields', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      customerMerge: {
        __args: {
          customerOneId,
          customerTwoId,
          ...(overrideFields ? { overrideFields } : {}),
        },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerMerge, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerMerge?.job?.id ?? '')
    printJson(result.customerMerge, ctx.format !== 'raw')
    return
  }

  if (verb === 'send-invite') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        email: { type: 'string' },
      },
    })
    const customerId = requireId(args.id as any, 'Customer')
    const emailRaw = (args as any).email as any
    const email =
      emailRaw !== undefined ? parseJsonArg(emailRaw, '--email', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      customerSendAccountInviteEmail: {
        __args: {
          customerId,
          ...(email ? { email } : {}),
        },
        customer: { id: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerSendAccountInviteEmail,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerSendAccountInviteEmail?.customer?.id ?? '')
    printJson(result.customerSendAccountInviteEmail, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Customer')
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
    printJson(result.customerUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Customer')
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
    printJson(result.customerDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for customers: ${verb}`, 2)
}
