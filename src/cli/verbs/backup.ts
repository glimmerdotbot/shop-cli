import { CliError } from '../errors'
import { buildInput } from '../input'
import { printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

const marketRegionSelection = {
  id: true,
  name: true,
} as const

export const runBackup = async ({
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
        '  shop backup <verb> [flags]',
        '',
        'Verbs:',
        '  available-regions|region|region-update',
      ].join('\n'),
    )
    return
  }

  if (verb === 'available-regions') {
    const result = await runQuery(ctx, { availableBackupRegions: marketRegionSelection as any })
    if (result === undefined) return
    const regions = result.availableBackupRegions ?? []
    if (ctx.quiet) {
      printIds(regions.map((r: any) => r?.id))
      return
    }
    printJson(regions, ctx.format !== 'raw')
    return
  }

  if (verb === 'region') {
    const result = await runQuery(ctx, { backupRegion: marketRegionSelection as any })
    if (result === undefined) return
    printNode({ node: result.backupRegion, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'region-update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      backupRegionUpdate: {
        __args: { region: built.input },
        backupRegion: marketRegionSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.backupRegionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.backupRegionUpdate?.backupRegion?.id ?? '')
    printJson(result.backupRegionUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for backup: ${verb}`, 2)
}

