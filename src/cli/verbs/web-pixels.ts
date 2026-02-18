import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { requireId } from './_shared'

const webPixelSelection = {
  id: true,
  settings: true,
} as const

const getWebPixelSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return webPixelSelection
}

export const runWebPixels = async ({
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
        '  shop web-pixels <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|update|delete',
        '',
        'Common output flags:',
        '  --view summary|ids|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebPixel')
    const selection = resolveSelection({
      resource: 'web-pixels',
      view: ctx.view,
      baseSelection: getWebPixelSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, { webPixel: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.webPixel, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      webPixelCreate: {
        __args: { webPixel: built.input },
        webPixel: webPixelSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webPixelCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webPixelCreate?.webPixel?.id ?? '')
    printJson(result.webPixelCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebPixel')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      webPixelUpdate: {
        __args: { id, webPixel: built.input },
        webPixel: webPixelSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webPixelUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webPixelUpdate?.webPixel?.id ?? '')
    printJson(result.webPixelUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebPixel')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      webPixelDelete: {
        __args: { id },
        deletedWebPixelId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webPixelDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webPixelDelete?.deletedWebPixelId ?? '')
    printJson(result.webPixelDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for web-pixels: ${verb}`, 2)
}
