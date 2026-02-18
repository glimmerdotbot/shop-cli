import { CliError } from '../errors'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv } from './_shared'

export const runTags = async ({
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
        '  shop tags <verb> [flags]',
        '',
        'Verbs:',
        '  add|remove',
      ].join('\n'),
    )
    return
  }

  if (verb === 'add' || verb === 'remove') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const idRaw = args.id as any
    if (typeof idRaw !== 'string' || !idRaw) throw new CliError('Missing --id', 2)
    const id = idRaw
    const tags = parseCsv(args.tags as any, '--tags')

    const mutationField = verb === 'add' ? 'tagsAdd' : 'tagsRemove'
    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { id, tags },
        node: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.node?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for tags: ${verb}`, 2)
}

