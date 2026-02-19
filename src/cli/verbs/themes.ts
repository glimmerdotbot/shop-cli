import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseJsonArg, parseStringList, requireId } from './_shared'

const themeSummarySelection = {
  id: true,
  name: true,
  role: true,
  processing: true,
  processingFailed: true,
  createdAt: true,
  updatedAt: true,
} as const

const themeFullSelection = {
  ...themeSummarySelection,
  prefix: true,
  files: {
    __args: { first: 20 },
    nodes: {
      filename: true,
      size: true,
      contentType: true,
      checksumMd5: true,
      updatedAt: true,
    },
  },
} as const

const getThemeSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return themeFullSelection
  if (view === 'raw') return {} as const
  return themeSummarySelection
}

const parseFilesArg = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CliError('Missing --files', 2)
  }
  const raw = value.trim()
  if (raw.startsWith('[') || raw.startsWith('@')) return parseJsonArg(raw, '--files')
  return parseStringList(raw, '--files')
}

export const runThemes = async ({
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
        '  shop themes <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|duplicate|publish',
        '  files-upsert|files-delete|files-copy',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'OnlineStoreTheme')
    const selection = resolveSelection({
      resource: 'themes',
      view: ctx.view,
      baseSelection: getThemeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { theme: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.theme, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: { roles: { type: 'string', multiple: true } } })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const roles = args.roles ? parseStringList(args.roles, '--roles', { allowEmpty: true }) : undefined

    const nodeSelection = resolveSelection({
      resource: 'themes',
      view: ctx.view,
      baseSelection: getThemeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      themes: {
        __args: { first, after, reverse, ...(roles && roles.length > 0 ? { roles } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.themes,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'themes',
        { first, reverse },
        roles && roles.length > 0 ? [{ flag: '--roles', value: roles.join(',') }] : undefined,
      ),
    })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { name: { type: 'string' }, role: { type: 'string' }, source: { type: 'string' } },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const input = built.used ? (built.input as any) : {}
    const name = (args.name as string | undefined) ?? input.name
    const role = (args.role as string | undefined) ?? input.role
    const source = (args.source as string | undefined) ?? input.source ?? input.src

    if (!source) throw new CliError('Missing --source (or --input with source/src)', 2)

    const result = await runMutation(ctx, {
      themeCreate: {
        __args: { source, ...(name ? { name } : {}), ...(role ? { role } : {}) },
        theme: themeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })

    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.themeCreate?.theme?.id ?? '')
    printJson(result.themeCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'OnlineStoreTheme')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      themeUpdate: {
        __args: { id, input: built.input },
        theme: themeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.themeUpdate?.theme?.id ?? '')
    printJson(result.themeUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'OnlineStoreTheme')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      themeDelete: {
        __args: { id },
        deletedThemeId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.themeDelete?.deletedThemeId ?? '')
    printJson(result.themeDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: { name: { type: 'string' } } })
    const id = requireId(args.id, 'OnlineStoreTheme')
    const name = args.name as string | undefined

    const result = await runMutation(ctx, {
      themeDuplicate: {
        __args: { id, ...(name ? { name } : {}) },
        newTheme: themeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.themeDuplicate?.newTheme?.id ?? '')
    printJson(result.themeDuplicate, ctx.format !== 'raw')
    return
  }

  if (verb === 'publish') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'OnlineStoreTheme')

    const result = await runMutation(ctx, {
      themePublish: {
        __args: { id },
        theme: themeSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themePublish, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.themePublish?.theme?.id ?? '')
    printJson(result.themePublish, ctx.format !== 'raw')
    return
  }

  if (verb === 'files-upsert') {
    const args = parseStandardArgs({ argv, extraOptions: { files: { type: 'string' } } })
    const id = requireId(args.id, 'OnlineStoreTheme')
    const files = parseJsonArg(args.files, '--files')

    const result = await runMutation(ctx, {
      themeFilesUpsert: {
        __args: { themeId: id, files },
        upsertedThemeFiles: { filename: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeFilesUpsert, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.themeFilesUpsert, ctx.format !== 'raw')
    return
  }

  if (verb === 'files-delete') {
    const args = parseStandardArgs({ argv, extraOptions: { files: { type: 'string' } } })
    const id = requireId(args.id, 'OnlineStoreTheme')
    const files = parseFilesArg(args.files)

    const result = await runMutation(ctx, {
      themeFilesDelete: {
        __args: { themeId: id, files },
        deletedThemeFiles: { filename: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeFilesDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const deleted = result.themeFilesDelete?.deletedThemeFiles ?? []
      for (const f of deleted) {
        const name = typeof (f as any)?.filename === 'string' ? (f as any).filename : ''
        if (name) process.stdout.write(`${name}\n`)
      }
      return
    }
    printJson(result.themeFilesDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'files-copy') {
    const args = parseStandardArgs({ argv, extraOptions: { files: { type: 'string' } } })
    const id = requireId(args.id, 'OnlineStoreTheme')
    const files = parseJsonArg(args.files, '--files')

    const result = await runMutation(ctx, {
      themeFilesCopy: {
        __args: { themeId: id, files },
        copiedThemeFiles: { filename: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.themeFilesCopy, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const copied = result.themeFilesCopy?.copiedThemeFiles ?? []
      for (const f of copied) {
        const name = typeof (f as any)?.filename === 'string' ? (f as any).filename : ''
        if (name) process.stdout.write(`${name}\n`)
      }
      return
    }
    printJson(result.themeFilesCopy, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for themes: ${verb}`, 2)
}
