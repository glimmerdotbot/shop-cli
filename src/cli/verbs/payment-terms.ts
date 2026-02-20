import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseFirst, parseIds, requireId } from './_shared'

const paymentTermsSummarySelection = {
  id: true,
  paymentTermsName: true,
  paymentTermsType: true,
  dueInDays: true,
  overdue: true,
  paymentSchedules: {
    __args: { first: 10 },
    nodes: {
      id: true,
      issuedAt: true,
      dueAt: true,
      amount: { amount: true, currencyCode: true },
      completedAt: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
} as const

const paymentTermsFullSelection = {
  ...paymentTermsSummarySelection,
} as const

const paymentTermsTemplateSummarySelection = {
  id: true,
  name: true,
  paymentTermsType: true,
  dueInDays: true,
  description: true,
} as const

const paymentTermsTemplateFullSelection = {
  ...paymentTermsTemplateSummarySelection,
} as const

const getPaymentTermsTemplateSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return paymentTermsTemplateFullSelection
  if (view === 'raw') return {} as const
  return paymentTermsTemplateSummarySelection
}

const ensureObjectInput = (value: any, label: string) => {
  if (value === null || typeof value !== 'object') throw new CliError(`${label} must be an object`, 2)
  return value as Record<string, any>
}

export const runPaymentTerms = async ({
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
        'Usage: shop payment-terms <verb> [flags]',
        '',
        'Verbs:',
        '  create          Create payment terms for an order',
        '  update          Update payment terms',
        '  delete          Delete payment terms',
        '  send-reminder   Send a payment reminder',
        '  templates       List payment terms templates',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Special flags:',
        '  --reference-id <gid|num>  (create)',
        '  --template-id <gid|num>   (create/update)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'templates') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const paymentTermsType = args.type as any

    const selection = resolveSelection({
      resource: 'payment-terms',
      typeName: 'PaymentTermsTemplate',
      view: ctx.view,
      baseSelection: getPaymentTermsTemplateSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      paymentTermsTemplates: {
        __args: paymentTermsType ? { paymentTermsType } : {},
        ...selection,
      },
    })
    if (result === undefined) return
    const nodes = result.paymentTermsTemplates ?? []
    printConnection({ connection: { nodes }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'reference-id': { type: 'string' }, 'template-id': { type: 'string' } } })
    const referenceId = (args as any)['reference-id'] as string | undefined
    if (!referenceId) throw new CliError('Missing --reference-id', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = ensureObjectInput(built.input, 'Payment terms input')

    const templateId = (args as any)['template-id'] as string | undefined
    if (templateId !== undefined && input.paymentTermsTemplateId === undefined) {
      input.paymentTermsTemplateId = coerceGid(templateId, 'PaymentTermsTemplate')
    }
    if (!input.paymentTermsTemplateId) {
      throw new CliError('Missing paymentTermsTemplateId (use --template-id or --set paymentTermsTemplateId=...)', 2)
    }

    const result = await runMutation(ctx, {
      paymentTermsCreate: {
        __args: {
          referenceId: coerceGid(referenceId, 'Order'),
          paymentTermsAttributes: input,
        },
        paymentTerms: paymentTermsSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentTermsCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.paymentTermsCreate?.paymentTerms?.id ?? '')
    printJson(result.paymentTermsCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: { 'template-id': { type: 'string' } } })
    const id = requireId(args.id, 'PaymentTerms')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = ensureObjectInput(built.input, 'Payment terms input')

    const templateId = (args as any)['template-id'] as string | undefined
    if (templateId !== undefined && input.paymentTermsTemplateId === undefined) {
      input.paymentTermsTemplateId = coerceGid(templateId, 'PaymentTermsTemplate')
    }
    if (Object.keys(input).length === 0) {
      throw new CliError('Nothing to update (expected paymentTermsTemplateId and/or paymentSchedules)', 2)
    }

    const result = await runMutation(ctx, {
      paymentTermsUpdate: {
        __args: { input: { paymentTermsId: id, paymentTermsAttributes: input } },
        paymentTerms: paymentTermsSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentTermsUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.paymentTermsUpdate?.paymentTerms?.id ?? '')
    printJson(result.paymentTermsUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PaymentTerms')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      paymentTermsDelete: {
        __args: { input: { paymentTermsId: id } },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentTermsDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.paymentTermsDelete?.deletedId ?? '')
    printJson(result.paymentTermsDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'send-reminder') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'PaymentSchedule')

    const result = await runMutation(ctx, {
      paymentReminderSend: {
        __args: { paymentScheduleId: id },
        success: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.paymentReminderSend, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.paymentReminderSend, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for payment-terms: ${verb}`, 2)
}
