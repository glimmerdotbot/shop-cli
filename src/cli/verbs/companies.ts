import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIds, requireId } from './_shared'

const companySummarySelection = {
  id: true,
  name: true,
  externalId: true,
  mainContact: { id: true, customer: { displayName: true, email: true } },
  contactCount: true,
  locationsCount: { count: true },
  ordersCount: { count: true },
  createdAt: true,
} as const

const companyFullSelection = {
  ...companySummarySelection,
  note: true,
  contacts: {
    __args: { first: 10 },
    nodes: {
      id: true,
      isMainContact: true,
      customer: { id: true, displayName: true, email: true },
      roles: { __args: { first: 5 }, nodes: { id: true, name: true } },
    },
  },
  locations: {
    __args: { first: 10 },
    nodes: {
      id: true,
      name: true,
      billingAddress: { address1: true, city: true, countryCode: true },
      shippingAddress: { address1: true, city: true, countryCode: true },
    },
  },
  events: {
    __args: { first: 5 },
    nodes: { id: true, message: true, createdAt: true },
  },
} as const

const getCompanySelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return companyFullSelection
  if (view === 'raw') return {} as const
  return companySummarySelection
}

export const runCompanies = async ({
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
        '  shop companies <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete|bulk-delete',
        '  assign-main-contact|revoke-main-contact|assign-customer',
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
    const id = requireId(args.id, 'Company')
    const selection = resolveSelection({
      resource: 'companies',
      view: ctx.view,
      baseSelection: getCompanySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { company: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.company, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'companies',
      view: ctx.view,
      baseSelection: getCompanySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      companies: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.companies, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const limit = args.limit === undefined ? undefined : Number(args.limit)
    if (args.limit !== undefined && (!Number.isFinite(limit) || (limit as number) <= 0)) {
      throw new CliError('--limit must be a positive integer', 2)
    }

    const result = await runQuery(ctx, {
      companiesCount: { __args: { ...(limit ? { limit: Math.floor(limit as number) } : {}) }, count: true, precision: true },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.companiesCount?.count ?? '')
    printJson(result.companiesCount, ctx.format !== 'raw')
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
      companyCreate: {
        __args: { input: built.input },
        company: companySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyCreate?.company?.id ?? '')
    printJson(result.companyCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Company')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      companyUpdate: {
        __args: { companyId: id, input: built.input },
        company: companySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyUpdate?.company?.id ?? '')
    printJson(result.companyUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Company')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      companyDelete: {
        __args: { id },
        deletedCompanyId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyDelete?.deletedCompanyId ?? '')
    printJson(result.companyDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    if (!args.yes) throw new CliError('Refusing to bulk-delete without --yes', 2)
    const companyIds = parseIds(args.ids, 'Company')

    const result = await runMutation(ctx, {
      companiesDelete: {
        __args: { companyIds },
        deletedCompanyIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companiesDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log((result.companiesDelete?.deletedCompanyIds ?? []).join('\n'))
    printJson(result.companiesDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-main-contact') {
    const args = parseStandardArgs({ argv, extraOptions: { 'contact-id': { type: 'string' } } })
    const companyId = requireId(args.id, 'Company')
    const contactId = requireId(args['contact-id'], 'CompanyContact')

    const result = await runMutation(ctx, {
      companyAssignMainContact: {
        __args: { companyId, companyContactId: contactId },
        company: companySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyAssignMainContact, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyAssignMainContact?.company?.id ?? '')
    printJson(result.companyAssignMainContact, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-main-contact') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const companyId = requireId(args.id, 'Company')

    const result = await runMutation(ctx, {
      companyRevokeMainContact: {
        __args: { companyId },
        company: companySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyRevokeMainContact, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyRevokeMainContact?.company?.id ?? '')
    printJson(result.companyRevokeMainContact, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-customer') {
    const args = parseStandardArgs({ argv, extraOptions: { 'customer-id': { type: 'string' } } })
    const companyId = requireId(args.id, 'Company')
    const customerId = requireId(args['customer-id'], 'Customer')

    const result = await runMutation(ctx, {
      companyAssignCustomerAsContact: {
        __args: { companyId, customerId },
        companyContact: { id: true, customer: { id: true, displayName: true, email: true } },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyAssignCustomerAsContact,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.companyAssignCustomerAsContact?.companyContact?.id ?? '')
    printJson(result.companyAssignCustomerAsContact, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for companies: ${verb}`, 2)
}
