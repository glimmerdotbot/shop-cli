import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseJsonArg, requireId } from './_shared'

const productResourceFeedbackSelection = {
  feedbackGeneratedAt: true,
  messages: true,
  productId: true,
  productUpdatedAt: true,
  state: true,
} as const

export const runResourceFeedback = async ({
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
        '  shop resource-feedback <verb> [flags]',
        '',
        'Verbs:',
        '  product-get|product-bulk-create|shop-create',
      ].join('\n'),
    )
    return
  }

  if (verb === 'product-get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')

    const result = await runQuery(ctx, {
      productResourceFeedback: { __args: { id }, ...productResourceFeedbackSelection },
    })
    if (result === undefined) return

    const feedback = result.productResourceFeedback
    if (ctx.quiet) return console.log(feedback?.productId ?? '')
    printJson(feedback, ctx.format !== 'raw')
    return
  }

  if (verb === 'product-bulk-create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const input = parseJsonArg(args.input, '--input')
    if (!Array.isArray(input)) throw new CliError('--input must be a JSON array', 2)

    const result = await runMutation(ctx, {
      bulkProductResourceFeedbackCreate: {
        __args: { feedbackInput: input as any },
        feedback: productResourceFeedbackSelection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.bulkProductResourceFeedbackCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.bulkProductResourceFeedbackCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'shop-create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      shopResourceFeedbackCreate: {
        __args: { input: built.input },
        feedback: {
          state: true,
          feedbackGeneratedAt: true,
          link: { label: true, url: true },
          messages: { message: true },
        },
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.shopResourceFeedbackCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.shopResourceFeedbackCreate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for resource-feedback: ${verb}`, 2)
}

