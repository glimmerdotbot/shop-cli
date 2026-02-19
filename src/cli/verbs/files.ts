import { CliError } from '../errors'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'
import { buildLocalFilesForStagedUpload, stagedUploadLocalFiles } from '../workflows/files/stagedUploads'
import { downloadUrlsToTempDir } from '../workflows/files/urlDownloads'
import { waitForFilesReadyOrFailed } from '../workflows/files/waitForReady'
import { printConnection, printIds, printJson, printNode } from '../output'
import { resolveCliCommand } from '../command'

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

const FILES_MEDIA_TYPES = new Set(['FILE', 'IMAGE', 'VIDEO', 'MODEL_3D'] as const)
type FilesMediaType = 'FILE' | 'IMAGE' | 'VIDEO' | 'MODEL_3D'

const normalizeFilesMediaType = (raw: string, flag: string): FilesMediaType => {
  const v = raw.trim().toUpperCase()
  if (!v) throw new CliError(`Invalid ${flag} value`, 2)
  if (FILES_MEDIA_TYPES.has(v as any)) return v as FilesMediaType
  throw new CliError(`${flag} must be FILE|IMAGE|VIDEO|MODEL_3D`, 2)
}

const parsePositiveIntFlag = ({
  value,
  flag,
}: {
  value: unknown
  flag: string
}): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new CliError(`Invalid ${flag} value`, 2)
  const trimmed = value.trim()
  if (!trimmed) throw new CliError(`Invalid ${flag} value`, 2)
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new CliError(`${flag} must be a positive integer`, 2)
  }
  return n
}

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
    const command = resolveCliCommand()
    console.log(
      [
        'Usage:',
        `  ${command} files <verb> [flags]`,
        '',
        'Verbs:',
        '  get|list|upload|update|delete|acknowledge-update-failed',
        '',
        'Upload flags:',
        '  --file <path>                 (repeatable)',
        '  --url <url>                   (repeatable)',
        '  --filename <name>             (only with exactly 1 --url)',
        '  --mime-type <mime>            (override MIME detection)',
        '  --media-type FILE|IMAGE|VIDEO|MODEL_3D',
        '  (aliases: --resource, --content-type)',
        '  --alt <text>',
        '  --wait',
        '  --poll-interval-ms <n>        (default: 1000)',
        '  --timeout-ms <n>              (default: 600000)',
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
      url: { type: 'string', multiple: true },
      filename: { type: 'string' },
      alt: { type: 'string' },
      'mime-type': { type: 'string' },
      'media-type': { type: 'string' },
      resource: { type: 'string' },
      'content-type': { type: 'string' },
      wait: { type: 'boolean' },
      'poll-interval-ms': { type: 'string' },
      'timeout-ms': { type: 'string' },
    },
  })

  const filePaths = (args.file as string[] | undefined) ?? []
  const urls = (args.url as string[] | undefined) ?? []
  const filenameOverride = args.filename as string | undefined

  if (filenameOverride && urls.length === 0) {
    throw new CliError('--filename is only valid with --url', 2)
  }

  if (filePaths.length > 0 && urls.length > 0) {
    throw new CliError('Do not mix --file and --url in a single invocation', 2)
  }

  if (filePaths.length === 0 && urls.length === 0) {
    throw new CliError('Missing --file (repeatable) or --url (repeatable)', 2)
  }

  const mediaTypeRaw = (args as any)['media-type'] as string | undefined
  const resourceAliasRaw = args.resource as string | undefined
  const contentTypeAliasRaw = args['content-type'] as string | undefined

  const parsedMediaType = mediaTypeRaw ? normalizeFilesMediaType(mediaTypeRaw, '--media-type') : undefined
  const parsedResourceAlias = resourceAliasRaw ? normalizeFilesMediaType(resourceAliasRaw, '--resource') : undefined
  const parsedContentTypeAlias = contentTypeAliasRaw
    ? normalizeFilesMediaType(contentTypeAliasRaw, '--content-type')
    : undefined

  const distinct = new Set([parsedMediaType, parsedResourceAlias, parsedContentTypeAlias].filter(Boolean) as string[])
  if (distinct.size > 1) {
    throw new CliError('Do not pass conflicting values for --media-type/--resource/--content-type', 2)
  }

  const mediaType = parsedMediaType ?? parsedResourceAlias ?? parsedContentTypeAlias

  const wait = args.wait === true
  const pollIntervalMs = parsePositiveIntFlag({
    value: args['poll-interval-ms'],
    flag: '--poll-interval-ms',
  }) ?? 1000
  const timeoutMs = parsePositiveIntFlag({
    value: args['timeout-ms'],
    flag: '--timeout-ms',
  }) ?? 10 * 60 * 1000

  let cleanupDownloads: (() => Promise<void>) | undefined
  let effectiveFilePaths = filePaths
  try {
    if (urls.length > 0) {
      const downloaded = await downloadUrlsToTempDir({ urls, filenameOverride })
      cleanupDownloads = downloaded.cleanup
      effectiveFilePaths = downloaded.files.map((f) => f.filePath)
    }

    const localFiles = await buildLocalFilesForStagedUpload({
      filePaths: effectiveFilePaths,
      mimeType: args['mime-type'] as any,
      resource: mediaType as any,
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
        // Keep fileCreate contentType consistent with staged upload resource.
        contentType: mediaType ?? local.resource,
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

    const createdIds = (result.fileCreate?.files ?? [])
      .map((f: any) => f?.id)
      .filter((id: any) => typeof id === 'string' && id.trim() !== '')

    if (ctx.quiet) {
      printIds(createdIds)
    } else {
      printJson(result.fileCreate)
    }

    if (!wait) return

    const final = await waitForFilesReadyOrFailed({
      ctx,
      ids: createdIds,
      pollIntervalMs,
      timeoutMs,
    })

    if (!ctx.quiet) {
      printJson(final)
    }

    if (final.failedIds.length > 0) {
      throw new CliError(`One or more files failed processing: ${final.failedIds.join(', ')}`, 2)
    }
  } finally {
    if (cleanupDownloads) await cleanupDownloads()
  }
}
