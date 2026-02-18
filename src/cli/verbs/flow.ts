import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseJsonArg, parseTextArg } from './_shared'

export const runFlow = async ({
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
        '  shop flow <verb> [flags]',
        '',
        'Verbs:',
        '  generate-signature|trigger-receive',
      ].join('\n'),
    )
    return
  }

  if (verb === 'generate-signature') {
    const args = parseStandardArgs({ argv, extraOptions: { payload: { type: 'string' } } })
    const idRaw = args.id
    if (typeof idRaw !== 'string' || !idRaw) throw new CliError('Missing --id', 2)
    const id = idRaw.startsWith('gid://') ? idRaw : coerceGid(idRaw, 'FlowActionDefinition')
    const payload = parseTextArg((args as any).payload, '--payload')

    const result = await runMutation(ctx, {
      flowGenerateSignature: {
        __args: { id, payload },
        payload: true,
        signature: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.flowGenerateSignature, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.flowGenerateSignature?.signature ?? '')
    printJson(result.flowGenerateSignature, ctx.format !== 'raw')
    return
  }

  if (verb === 'trigger-receive') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        handle: { type: 'string' },
        payload: { type: 'string' },
      },
    })
    const handle = parseTextArg((args as any).handle, '--handle')
    const payload = parseJsonArg((args as any).payload, '--payload')

    const result = await runMutation(ctx, {
      flowTriggerReceive: {
        __args: { handle, payload },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.flowTriggerReceive, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.flowTriggerReceive, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for flow: ${verb}`, 2)
}

