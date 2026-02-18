import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { lookup } from 'mime-types'

import { CliError } from '../../errors'
import { runMutation, type CommandContext } from '../../router'
import { maybeFailOnUserErrors } from '../../userErrors'

export type StagedUploadResource = 'FILE' | 'IMAGE' | 'VIDEO' | 'MODEL_3D'

export type LocalFileForStagedUpload = {
  filePath: string
  filename: string
  mimeType: string
  resource: StagedUploadResource
  fileSize: number
}

export type StagedUploadTarget = {
  url: string
  resourceUrl: string
  parameters: Array<{ name: string; value: string }>
}

const guessMimeTypeFromFilename = (filename: string): string => {
  const mimeType = lookup(filename)
  if (typeof mimeType === 'string') return mimeType
  return 'application/octet-stream'
}

const inferStagedUploadResource = ({
  filename,
  mimeType,
}: {
  filename: string
  mimeType: string
}): StagedUploadResource => {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType.startsWith('video/')) return 'VIDEO'

  const ext = path.extname(filename).toLowerCase()
  if (mimeType.startsWith('model/') || ext === '.glb' || ext === '.gltf' || ext === '.usdz') {
    return 'MODEL_3D'
  }

  return 'FILE'
}

export const buildLocalFilesForStagedUpload = ({
  filePaths,
  contentType,
  resource,
}: {
  filePaths: string[]
  contentType?: string
  resource?: StagedUploadResource
}): LocalFileForStagedUpload[] => {
  if (filePaths.length === 0) return []

  return filePaths.map((filePath) => {
    const stats = statSync(filePath)
    if (!stats.isFile()) throw new CliError(`Not a file: ${filePath}`, 2)

    const filename = path.basename(filePath)
    const mimeType = contentType ?? guessMimeTypeFromFilename(filename)
    const inferredResource = inferStagedUploadResource({ filename, mimeType })

    return {
      filePath,
      filename,
      mimeType,
      resource: resource ?? inferredResource,
      fileSize: stats.size,
    }
  })
}

export const stagedUploadsCreate = async (
  ctx: CommandContext,
  localFiles: LocalFileForStagedUpload[],
): Promise<StagedUploadTarget[] | undefined> => {
  const input = localFiles.map((f) => ({
    filename: f.filename,
    mimeType: f.mimeType,
    resource: f.resource,
    fileSize: String(f.fileSize),
    httpMethod: 'POST',
  }))

  const result = await runMutation(ctx, {
    stagedUploadsCreate: {
      __args: { input },
      stagedTargets: {
        url: true,
        resourceUrl: true,
        parameters: { name: true, value: true },
      },
      userErrors: { field: true, message: true },
    },
  })
  if (result === undefined) return undefined

  maybeFailOnUserErrors({
    payload: result.stagedUploadsCreate,
    failOnUserErrors: ctx.failOnUserErrors,
  })

  const targets = result.stagedUploadsCreate?.stagedTargets ?? []
  if (!Array.isArray(targets) || targets.length !== localFiles.length) {
    throw new CliError(
      `Expected ${localFiles.length} stagedTargets, got ${Array.isArray(targets) ? targets.length : 'non-array'}`,
      2,
    )
  }

  return targets.map((t) => ({
    url: String(t.url ?? ''),
    resourceUrl: String(t.resourceUrl ?? ''),
    parameters: (t.parameters ?? []).map((p: any) => ({ name: p.name, value: p.value })),
  }))
}

export const uploadToStagedTarget = async ({
  target,
  localFile,
}: {
  target: StagedUploadTarget
  localFile: LocalFileForStagedUpload
}) => {
  const body = readFileSync(localFile.filePath)

  const form = new FormData()
  for (const p of target.parameters) form.set(p.name, p.value)
  form.set('file', new Blob([body], { type: localFile.mimeType }), localFile.filename)

  const res = await fetch(target.url, { method: 'POST', body: form })
  if (res.ok) return

  let details = ''
  try {
    details = await res.text()
  } catch {
    // ignore
  }
  throw new CliError(
    `Staged upload failed for ${localFile.filename}: ${res.status} ${res.statusText}${details ? `\n${details}` : ''}`,
    2,
  )
}

export const stagedUploadLocalFiles = async (
  ctx: CommandContext,
  localFiles: LocalFileForStagedUpload[],
): Promise<StagedUploadTarget[] | undefined> => {
  const targets = await stagedUploadsCreate(ctx, localFiles)
  if (targets === undefined) return undefined

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!
    const localFile = localFiles[i]!
    await uploadToStagedTarget({ target, localFile })
  }

  return targets
}
