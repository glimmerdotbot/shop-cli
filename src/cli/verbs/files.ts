import { CliError } from '../errors'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'
import { buildLocalFilesForStagedUpload, stagedUploadLocalFiles } from '../workflows/files/stagedUploads'
import { printConnection, printIds, printJson, printNode } from '../output'

import { buildListNextPageArgs, parseFirst, parseIds, requireId } from './_shared'

const fileSelection = {
  id: true,
  alt: true,
  fileStatus: true,
  createdAt: true,
  updatedAt: true,
  preview: { status: true, image: { url: true } },
  fileErrors: { code: true, message: true, details: true },
} as const

export const runFiles = async ({
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
        '  shop files <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|upload|update|delete|acknowledge-update-failed',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'acknowledge-update-failed') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const ids =
      args.ids !== undefined
        ? parseIds(args.ids as any, 'File')
        : args.id
          ? [requireId(args.id as any, 'File')]
          : []

    if (ids.length === 0) throw new CliError('Missing --id or --ids', 2)

    const result = await runMutation(ctx, {
      fileAcknowledgeUpdateFailed: {
        __args: { fileIds: ids },
        files: fileSelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileAcknowledgeUpdateFailed, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      printIds((result.fileAcknowledgeUpdateFailed?.files ?? []).map((f: any) => f?.id))
      return
    }
    printJson(result.fileAcknowledgeUpdateFailed, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const raw = args.id as string | undefined
    if (!raw) throw new CliError('Missing --id', 2)
    const trimmed = raw.trim()
    if (!trimmed) throw new CliError('Missing --id', 2)

    const query =
      trimmed.startsWith('gid://')
        ? `ids:${trimmed}`
        : /^\d+$/.test(trimmed)
          ? `id:${trimmed}`
          : (() => {
              throw new CliError('--id must be a numeric ID or full gid://shopify/... GID', 2)
            })()

    const result = await runQuery(ctx, {
      files: { __args: { first: 1, query }, nodes: fileSelection },
    })
    if (result === undefined) return
    const node = (result.files?.nodes ?? [])[0]
    printNode({ node, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const result = await runQuery(ctx, {
      files: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: fileSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.files,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('files', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const ids =
      args.ids !== undefined
        ? parseIds(args.ids as any, 'File')
        : args.id
          ? [requireId(args.id as any, 'File')]
          : []

    if (ids.length === 0) throw new CliError('Missing --id or --ids', 2)

    const result = await runMutation(ctx, {
      fileDelete: {
        __args: { fileIds: ids },
        deletedFileIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      printIds((result.fileDelete?.deletedFileIds ?? []).map((id: any) => id as any))
      return
    }
    printJson(result.fileDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        alt: { type: 'string' },
      },
    })
    const id = requireId(args.id as any, 'File')
    const alt = (args as any).alt as string | undefined
    if (alt === undefined) throw new CliError('Missing --alt', 2)

    const result = await runMutation(ctx, {
      fileUpdate: {
        __args: { files: [{ id, alt }] },
        files: fileSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log((result.fileUpdate?.files ?? [])[0]?.id ?? '')
    printJson(result.fileUpdate, ctx.format !== 'raw')
    return
  }

  if (verb !== 'upload') {
    throw new CliError(`Unknown verb for files: ${verb}`, 2)
  }

  const args = parseStandardArgs({
    argv,
    extraOptions: {
      file: { type: 'string', multiple: true },
      alt: { type: 'string' },
      'content-type': { type: 'string' },
    },
  })

  const filePaths = (args.file as string[] | undefined) ?? []
  if (filePaths.length === 0) throw new CliError('Missing --file (repeatable)', 2)

  const localFiles = buildLocalFilesForStagedUpload({
    filePaths,
    contentType: args['content-type'] as any,
  })

  const targets = await stagedUploadLocalFiles(ctx, localFiles)
  if (targets === undefined) return

  const alt = args.alt as string | undefined
  const files = targets.map((t, i) => {
    const local = localFiles[i]!
    if (!t.resourceUrl) throw new CliError(`Missing staged target resourceUrl for ${local.filename}`, 2)
    return {
      originalSource: t.resourceUrl,
      filename: local.filename,
      ...(alt ? { alt } : {}),
    }
  })

  const result = await runMutation(ctx, {
    fileCreate: {
      __args: { files },
      files: fileSelection,
      userErrors: { field: true, message: true },
    },
  })
  if (result === undefined) return

  maybeFailOnUserErrors({ payload: result.fileCreate, failOnUserErrors: ctx.failOnUserErrors })

  if (ctx.quiet) {
    printIds((result.fileCreate?.files ?? []).map((f: any) => f?.id))
    return
  }

  printJson(result.fileCreate)
}
