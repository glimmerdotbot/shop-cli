import { CliError } from '../errors'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

export const runPublishables = async ({
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
        '  shop publishables <verb> [flags]',
        '',
        'Verbs:',
        '  publish-to-current-channel|unpublish-to-current-channel',
        '',
        'Notes:',
        '  --id must be a full gid://shopify/... ID (numeric IDs cannot be coerced for Publishable).',
      ].join('\n'),
    )
    return
  }

  if (verb === 'publish-to-current-channel' || verb === 'unpublish-to-current-channel') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = args.id as any
    if (typeof id !== 'string' || !id) throw new CliError('Missing --id', 2)

    const mutation =
      verb === 'publish-to-current-channel'
        ? 'publishablePublishToCurrentChannel'
        : 'publishableUnpublishToCurrentChannel'

    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { id },
        publishable: { __typename: true, publishedOnCurrentChannel: true },
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(id)
    printJson(payload, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for publishables: ${verb}`, 2)
}
