import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson } from '../output'
import { parseStandardArgs, type CommandContext } from '../router'
import { upsertProductVariants } from '../workflows/productVariants/upsert'

export const runProductVariants = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'upsert') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string' },
        'allow-partial-updates': { type: 'boolean' },
        strategy: { type: 'string' },
      },
    })

    const strategy = args.strategy as string | undefined
    if (
      strategy &&
      !['DEFAULT', 'PRESERVE_STANDALONE_VARIANT', 'REMOVE_STANDALONE_VARIANT'].includes(strategy)
    ) {
      throw new CliError(
        `--strategy must be one of DEFAULT|PRESERVE_STANDALONE_VARIANT|REMOVE_STANDALONE_VARIANT. Got: ${strategy}`,
        2,
      )
    }

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const payload = await upsertProductVariants({
      ctx,
      productId: args['product-id'] as any,
      input: built.input,
      allowPartialUpdates: Boolean(args['allow-partial-updates']),
      strategy,
    })
    if (payload === undefined) return

    printJson(payload)
    return
  }

  throw new CliError(`Unknown verb for product-variants: ${verb}`, 2)
}
