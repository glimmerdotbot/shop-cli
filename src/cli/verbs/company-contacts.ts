import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseIds, parseJsonArg, parseStringList, requireId } from './_shared'

const companyContactSummarySelection = {
  id: true,
  isMainContact: true,
  customer: { id: true, displayName: true, email: true },
} as const

const companyContactFullSelection = {
  ...companyContactSummarySelection,
  locale: true,
  title: true,
  roles: {
    __args: { first: 10 },
    nodes: { id: true, name: true },
  },
} as const

const getCompanyContactSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return companyContactFullSelection
  if (view === 'raw') return {} as const
  return companyContactSummarySelection
}

const companyContactRoleSelection = {
  id: true,
  name: true,
  note: true,
} as const

export const runCompanyContacts = async ({
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
        '  shop company-contacts <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|update|delete|bulk-delete',
        '  role-get',
        '  assign-role|assign-roles|revoke-role|revoke-roles',
        '  remove-from-company|send-welcome-email',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'role-get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyContactRole')
    const result = await runQuery(ctx, { companyContactRole: { __args: { id }, ...companyContactRoleSelection } })
    if (result === undefined) return
    printNode({ node: result.companyContactRole, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyContact')
    const selection = resolveSelection({
      resource: 'company-contacts',
      view: ctx.view,
      baseSelection: getCompanyContactSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { companyContact: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.companyContact, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'company-id': { type: 'string' } } })
    const companyId = requireId(args['company-id'], 'Company')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      companyContactCreate: {
        __args: { companyId, input: built.input },
        companyContact: companyContactSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyContactCreate?.companyContact?.id ?? '')
    printJson(result.companyContactCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyContact')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      companyContactUpdate: {
        __args: { companyContactId: id, input: built.input },
        companyContact: companyContactSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyContactUpdate?.companyContact?.id ?? '')
    printJson(result.companyContactUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyContact')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      companyContactDelete: {
        __args: { companyContactId: id },
        deletedCompanyContactId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyContactDelete?.deletedCompanyContactId ?? '')
    printJson(result.companyContactDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    if (!args.yes) throw new CliError('Refusing to bulk-delete without --yes', 2)
    const companyContactIds = parseIds(args.ids, 'CompanyContact')

    const result = await runMutation(ctx, {
      companyContactsDelete: {
        __args: { companyContactIds },
        deletedCompanyContactIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactsDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log((result.companyContactsDelete?.deletedCompanyContactIds ?? []).join('\n'))
    printJson(result.companyContactsDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-role') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'role-id': { type: 'string' },
        'location-id': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'CompanyContact')
    const roleId = requireId(args['role-id'], 'CompanyContactRole')
    const locationId = requireId(args['location-id'], 'CompanyLocation')

    const result = await runMutation(ctx, {
      companyContactAssignRole: {
        __args: { companyContactId: id, companyContactRoleId: roleId, companyLocationId: locationId },
        companyContactRoleAssignment: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactAssignRole, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyContactAssignRole?.companyContactRoleAssignment?.id ?? '')
    printJson(result.companyContactAssignRole, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-roles') {
    const args = parseStandardArgs({ argv, extraOptions: { 'role-assignments': { type: 'string' } } })
    const id = requireId(args.id, 'CompanyContact')
    const rolesToAssign = parseJsonArg(args['role-assignments'], '--role-assignments')

    const result = await runMutation(ctx, {
      companyContactAssignRoles: {
        __args: { companyContactId: id, rolesToAssign },
        roleAssignments: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactAssignRoles, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const ids = (result.companyContactAssignRoles?.roleAssignments ?? []).map((r: any) => r?.id)
      return console.log(ids.filter(Boolean).join('\n'))
    }
    printJson(result.companyContactAssignRoles, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-role') {
    const args = parseStandardArgs({ argv, extraOptions: { 'role-assignment-id': { type: 'string' } } })
    const id = requireId(args.id, 'CompanyContact')
    const assignmentId = requireId(args['role-assignment-id'], 'CompanyContactRoleAssignment')

    const result = await runMutation(ctx, {
      companyContactRevokeRole: {
        __args: { companyContactId: id, companyContactRoleAssignmentId: assignmentId },
        revokedCompanyContactRoleAssignmentId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactRevokeRole, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyContactRevokeRole?.revokedCompanyContactRoleAssignmentId ?? '')
    printJson(result.companyContactRevokeRole, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-roles') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'role-assignment-ids': { type: 'string', multiple: true }, all: { type: 'boolean' } },
    })
    const id = requireId(args.id, 'CompanyContact')
    const revokeAll = Boolean(args.all)
    const roleAssignmentIds = revokeAll
      ? undefined
      : parseStringList(args['role-assignment-ids'], '--role-assignment-ids')

    const result = await runMutation(ctx, {
      companyContactRevokeRoles: {
        __args: { companyContactId: id, revokeAll, ...(roleAssignmentIds ? { roleAssignmentIds } : {}) },
        revokedRoleAssignmentIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyContactRevokeRoles, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const ids = result.companyContactRevokeRoles?.revokedRoleAssignmentIds ?? []
      return console.log(ids.filter(Boolean).join('\n'))
    }
    printJson(result.companyContactRevokeRoles, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-from-company') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyContact')

    const result = await runMutation(ctx, {
      companyContactRemoveFromCompany: {
        __args: { companyContactId: id },
        removedCompanyContactId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyContactRemoveFromCompany,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.companyContactRemoveFromCompany?.removedCompanyContactId ?? '')
    printJson(result.companyContactRemoveFromCompany, ctx.format !== 'raw')
    return
  }

  if (verb === 'send-welcome-email') {
    const args = parseStandardArgs({ argv, extraOptions: { email: { type: 'string' } } })
    const id = requireId(args.id, 'CompanyContact')
    const email = args.email ? parseJsonArg(args.email, '--email', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      companyContactSendWelcomeEmail: {
        __args: { companyContactId: id, ...(email ? { email } : {}) },
        companyContact: companyContactSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyContactSendWelcomeEmail,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.companyContactSendWelcomeEmail?.companyContact?.id ?? '')
    printJson(result.companyContactSendWelcomeEmail, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for company-contacts: ${verb}`, 2)
}
