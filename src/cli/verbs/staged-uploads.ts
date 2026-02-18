import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseJsonArg } from './_shared'

const stagedUploadTargetSelection = {
  url: true,
  parameters: { name: true, value: true },
} as const

export const runStagedUploads = async ({
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
        '  shop staged-uploads <verb> [flags]',
        '',
        'Verbs:',
        '  target-generate|targets-generate',
      ].join('\n'),
    )
    return
  }

  if (verb === 'target-generate') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        resource: { type: 'string' },
        filename: { type: 'string' },
        'mime-type': { type: 'string' },
        'file-size': { type: 'string' },
        'http-method': { type: 'string' },
      },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const resource = (args as any).resource ?? input.resource
    const filename = (args as any).filename ?? input.filename
    const mimeType = (args as any)['mime-type'] ?? input.mimeType

    if (!resource) throw new CliError('Missing --resource', 2)
    if (!filename) throw new CliError('Missing --filename', 2)
    if (!mimeType) throw new CliError('Missing --mime-type', 2)

    const fileSize = (args as any)['file-size'] ?? input.fileSize
    const httpMethod = (args as any)['http-method'] ?? input.httpMethod

    const result = await runMutation(ctx, {
      stagedUploadTargetGenerate: {
        __args: {
          input: {
            resource,
            filename,
            mimeType,
            ...(fileSize ? { fileSize: String(fileSize) } : {}),
            ...(httpMethod ? { httpMethod } : {}),
          },
        },
        ...stagedUploadTargetSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.stagedUploadTargetGenerate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return
    printJson(result.stagedUploadTargetGenerate, ctx.format !== 'raw')
    return
  }

  if (verb === 'targets-generate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const raw = args.input as any
    if (!raw) throw new CliError('Missing --input', 2)
    const input = parseJsonArg(raw, '--input')
    if (!Array.isArray(input)) throw new CliError('--input must be a JSON array', 2)

    const result = await runMutation(ctx, {
      stagedUploadTargetsGenerate: {
        __args: { input },
        urls: stagedUploadTargetSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.stagedUploadTargetsGenerate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return
    printJson(result.stagedUploadTargetsGenerate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for staged-uploads: ${verb}`, 2)
}
