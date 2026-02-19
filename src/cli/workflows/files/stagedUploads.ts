import { statSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

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

const mimeTypeFromFilename = (filename: string): string | undefined => {
  const mimeType = lookup(filename)
  if (typeof mimeType === 'string') return mimeType
  return undefined
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

const sniffMimeTypeFromFile = async (filePath: string): Promise<string | undefined> => {
  try {
    const mod = await import('file-type')
    const result = await mod.fileTypeFromFile(filePath)
    return result?.mime
  } catch {
    return undefined
  }
}

const resolveMimeType = async ({
  filePath,
  filename,
  forcedMimeType,
}: {
  filePath: string
  filename: string
  forcedMimeType?: string
}): Promise<string> => {
  const forced = typeof forcedMimeType === 'string' ? forcedMimeType.trim() : ''
  if (forced) return forced

  const sniffed = await sniffMimeTypeFromFile(filePath)
  if (sniffed) return sniffed

  const byExt = mimeTypeFromFilename(filename)
  if (byExt) return byExt

  throw new CliError(
    `Unable to determine MIME type for ${filename}. Pass --mime-type <mime>.`,
    2,
  )
}

export const buildLocalFilesForStagedUpload = async ({
  filePaths,
  mimeType,
  resource,
}: {
  filePaths: string[]
  mimeType?: string
  resource?: StagedUploadResource
}): Promise<LocalFileForStagedUpload[]> => {
  if (filePaths.length === 0) return []

  return Promise.all(filePaths.map(async (filePath) => {
    const stats = statSync(filePath)
    if (!stats.isFile()) throw new CliError(`Not a file: ${filePath}`, 2)

    const filename = path.basename(filePath)
    const resolvedMimeType = await resolveMimeType({ filePath, filename, forcedMimeType: mimeType })
    const inferredResource = inferStagedUploadResource({ filename, mimeType: resolvedMimeType })

    return {
      filePath,
      filename,
      mimeType: resolvedMimeType,
      resource: resource ?? inferredResource,
      fileSize: stats.size,
    }
  }))
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

  if (ctx.dryRun) {
    await runMutation(ctx, {
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

    return localFiles.map((f, i) => ({
      url: `https://example.invalid/staged-uploads/${i}`,
      resourceUrl: `https://example.invalid/staged-resources/${encodeURIComponent(f.filename)}`,
      parameters: [],
    }))
  }

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
  const args: string[] = ['--fail-with-body', '--silent', '--show-error', '-X', 'POST']

  for (const p of target.parameters) {
    args.push('--form-string', `${p.name}=${p.value}`)
  }

  // Stream file from disk, forcing MIME type for the file part
  args.push(
    '--form',
    `file=@${localFile.filePath};type=${localFile.mimeType};filename=${localFile.filename}`,
    target.url,
  )

  let child: ReturnType<typeof spawn>
  try {
    child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err: any) {
    throw err
  }

  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
  })
  child.stderr?.on('data', (chunk) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
  })

  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', (err: any) => {
      if (err && err.code === 'ENOENT') {
        reject(new CliError('curl is required for streaming staged uploads (curl not found on PATH)', 2))
        return
      }
      reject(err)
    })
    child.on('close', (c) => resolve(c ?? 1))
  })

  if (code === 0) return

  const trimmedErr = stderr.trim()
  const trimmedOut = stdout.trim()
  const details = trimmedErr || trimmedOut
  throw new CliError(
    `Staged upload failed for ${localFile.filename}: curl exited with code ${code}${details ? `\n${details}` : ''}`,
    2,
  )
}

export const stagedUploadLocalFiles = async (
  ctx: CommandContext,
  localFiles: LocalFileForStagedUpload[],
): Promise<StagedUploadTarget[] | undefined> => {
  const targets = await stagedUploadsCreate(ctx, localFiles)
  if (targets === undefined) return undefined

  if (ctx.dryRun) return targets

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!
    const localFile = localFiles[i]!
    await uploadToStagedTarget({ target, localFile })
  }

  return targets
}
