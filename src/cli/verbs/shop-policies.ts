import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

const shopPolicySummarySelection = {
  id: true,
  type: true,
  title: true,
  url: true,
  updatedAt: true,
} as const

const shopPolicyFullSelection = {
  ...shopPolicySummarySelection,
  body: true,
  createdAt: true,
} as const

const getShopPolicySelection = (view: CommandContext['view']) => {
  if (view === 'full') return shopPolicyFullSelection
  if (view === 'raw') return {} as const
  return shopPolicySummarySelection
}

export const runShopPolicies = async ({
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
    const selection = getShopPolicySelection(ctx.view)

    const result = await runQuery(ctx, { shop: { shopPolicies: selection } })
    if (result === undefined) return
    const nodes = result.shop?.shopPolicies ?? []
    printConnection({ connection: { nodes }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = built.input
    if (!input || typeof input !== 'object') throw new CliError('Policy input must be an object', 2)
    if (!(input as any).type) throw new CliError('Missing type (ShopPolicyType)', 2)
    if ((input as any).body === undefined) throw new CliError('Missing body', 2)

    const result = await runMutation(ctx, {
      shopPolicyUpdate: {
        __args: { shopPolicy: input },
        shopPolicy: shopPolicySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shopPolicyUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.shopPolicyUpdate?.shopPolicy?.id ?? '')
    printJson(result.shopPolicyUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for shop-policies: ${verb}`, 2)
}

