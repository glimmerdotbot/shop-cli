import { CliError } from '../errors'
import { buildInput } from '../input'
import { printIds, printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

const asArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value as any[]
  if (value && typeof value === 'object') return [value]
  return []
}

const requireOwnerId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --owner-id', 2)
  return value
}

export const runMetafields = async ({
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
        '  shop metafields <verb> [flags]',
        '',
        'Verbs:',
        '  delete',
      ].join('\n'),
    )
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'owner-id': { type: 'string' },
        namespace: { type: 'string' },
        key: { type: 'string' },
      },
    })
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const fromInput = built.used ? asArray(built.input) : []

    const ownerIdRaw = (args as any)['owner-id'] ?? (args as any).id
    const namespace = (args as any).namespace as string | undefined
    const key = (args as any).key as string | undefined

    const fromFlags =
      fromInput.length > 0
        ? []
        : [
            {
              ownerId: requireOwnerId(ownerIdRaw),
              namespace: namespace ?? (() => { throw new CliError('Missing --namespace', 2) })(),
              key: key ?? (() => { throw new CliError('Missing --key', 2) })(),
            },
          ]

    const metafields = fromInput.length > 0 ? fromInput : fromFlags

    const result = await runMutation(ctx, {
      metafieldsDelete: {
        __args: { metafields },
        deletedMetafields: { ownerId: true, namespace: true, key: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metafieldsDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      printIds(
        (result.metafieldsDelete?.deletedMetafields ?? []).map((m: any) =>
          m?.ownerId && m?.namespace && m?.key ? `${m.ownerId}:${m.namespace}:${m.key}` : undefined,
        ),
      )
      return
    }
    printJson(result.metafieldsDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for metafields: ${verb}`, 2)
}
