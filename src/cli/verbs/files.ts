import { CliError } from '../errors'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'
import { buildLocalFilesForStagedUpload, stagedUploadLocalFiles } from '../workflows/files/stagedUploads'
import { printIds, printJson } from '../output'

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

