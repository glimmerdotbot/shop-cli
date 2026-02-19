import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import os from 'node:os'
import path from 'node:path'

import { CliError } from '../../errors'

const safeBasename = (name: string): string => name.replace(/[\\/]/g, '_')

export const inferFilenameFromUrl = (rawUrl: string): string => {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    throw new CliError(`Invalid URL: ${rawUrl}`, 2)
  }

  const base = path.posix.basename(u.pathname || '')
  if (base && base !== '/' && base !== '.') {
    try {
      const decoded = decodeURIComponent(base)
      return safeBasename(decoded) || 'download'
    } catch {
      return safeBasename(base) || 'download'
    }
  }

  return 'download'
}

const uniqueFilename = (requested: string, used: Map<string, number>): string => {
  const base = safeBasename(requested) || 'download'
  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  if (count === 0) return base

  const ext = path.extname(base)
  const stem = ext ? base.slice(0, -ext.length) : base
  return `${stem}-${count + 1}${ext}`
}

export type DownloadedUrlFile = {
  url: string
  filePath: string
  filename: string
}

export const downloadUrlsToTempDir = async ({
  urls,
  filenameOverride,
}: {
  urls: string[]
  filenameOverride?: string
}): Promise<{ tempDir: string; files: DownloadedUrlFile[]; cleanup: () => Promise<void> }> => {
  if (urls.length === 0) throw new CliError('Missing --url (repeatable)', 2)
  if (filenameOverride && urls.length !== 1) {
    throw new CliError('--filename is only valid when exactly 1 --url is provided', 2)
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'shop-cli-files-upload-'))
  const cleanup = async () => {
    await rm(tempDir, { recursive: true, force: true })
  }

  try {
    await mkdir(tempDir, { recursive: true })

    const used = new Map<string, number>()
    const files: DownloadedUrlFile[] = []

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!
      const inferred = filenameOverride ?? inferFilenameFromUrl(url)
      const filename = uniqueFilename(inferred, used)
      const filePath = path.join(tempDir, filename)

      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) {
        throw new CliError(`Failed to download ${url}: ${res.status} ${res.statusText}`, 2)
      }
      if (!res.body) {
        throw new CliError(`Failed to download ${url}: empty response body`, 2)
      }

      const nodeStream = Readable.fromWeb(res.body as any)
      const out = createWriteStream(filePath)
      await pipeline(nodeStream, out)

      files.push({ url, filePath, filename })
    }

    return { tempDir, files, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}

