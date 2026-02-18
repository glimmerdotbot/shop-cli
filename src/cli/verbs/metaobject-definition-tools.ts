import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

const metaobjectDefinitionSelection = {
  id: true,
  name: true,
  type: true,
} as const

export const runMetaobjectDefinitionTools = async ({
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
        '  shop metaobject-definition-tools <verb> [flags]',
        '',
        'Verbs:',
        '  standard-enable',
      ].join('\n'),
    )
    return
  }

  if (verb === 'standard-enable') {
    const args = parseStandardArgs({ argv, extraOptions: { type: { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const type = args.type ?? input.type
    if (!type) throw new CliError('Missing --type', 2)

    const result = await runMutation(ctx, {
      standardMetaobjectDefinitionEnable: {
        __args: { type },
        metaobjectDefinition: metaobjectDefinitionSelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.standardMetaobjectDefinitionEnable,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.standardMetaobjectDefinitionEnable?.metaobjectDefinition?.id ?? '')
    printJson(result.standardMetaobjectDefinitionEnable, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for metaobject-definition-tools: ${verb}`, 2)
}

