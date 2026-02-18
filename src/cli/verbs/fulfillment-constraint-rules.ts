import { CliError } from '../errors'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseJsonArg, requireId } from './_shared'

const ruleSummarySelection = {
  id: true,
  deliveryMethodTypes: true,
  function: { id: true, title: true, handle: true, apiType: true },
} as const

export const runFulfillmentConstraintRules = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const result = await runQuery(ctx, { fulfillmentConstraintRules: ruleSummarySelection })
    if (result === undefined) return
    const nodes = result.fulfillmentConstraintRules ?? []
    printConnection({ connection: { nodes }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'delivery-method-types': { type: 'string' },
        'function-handle': { type: 'string' },
        'function-id': { type: 'string' },
        metafields: { type: 'string' },
      },
    })

    const deliveryMethodTypes = parseCsv((args as any)['delivery-method-types'], '--delivery-method-types')
    const functionHandle = (args as any)['function-handle'] as string | undefined
    const functionId = (args as any)['function-id'] as string | undefined

    if (!functionHandle && !functionId) {
      throw new CliError('Missing --function-handle (preferred) or --function-id', 2)
    }

    const metafields = (args as any).metafields ? parseJsonArg((args as any).metafields, '--metafields', { allowEmpty: true }) : undefined
    if ((args as any).metafields && metafields !== undefined && !Array.isArray(metafields)) {
      throw new CliError('--metafields must be a JSON array', 2)
    }

    const result = await runMutation(ctx, {
      fulfillmentConstraintRuleCreate: {
        __args: {
          deliveryMethodTypes,
          ...(functionHandle ? { functionHandle } : {}),
          ...(functionId ? { functionId } : {}),
          ...(metafields ? { metafields } : {}),
        },
        fulfillmentConstraintRule: ruleSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentConstraintRuleCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentConstraintRuleCreate?.fulfillmentConstraintRule?.id ?? '')
    printJson(result.fulfillmentConstraintRuleCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'delivery-method-types': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'FulfillmentConstraintRule')
    const deliveryMethodTypes = parseCsv((args as any)['delivery-method-types'], '--delivery-method-types')

    const result = await runMutation(ctx, {
      fulfillmentConstraintRuleUpdate: {
        __args: { id, deliveryMethodTypes },
        fulfillmentConstraintRule: ruleSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentConstraintRuleUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentConstraintRuleUpdate?.fulfillmentConstraintRule?.id ?? '')
    printJson(result.fulfillmentConstraintRuleUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'FulfillmentConstraintRule')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      fulfillmentConstraintRuleDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentConstraintRuleDelete,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentConstraintRuleDelete?.deletedId ?? '')
    printJson(result.fulfillmentConstraintRuleDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for fulfillment-constraint-rules: ${verb}`, 2)
}
