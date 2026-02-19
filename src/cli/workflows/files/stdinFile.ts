import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

import { CliError } from '../../errors'

const safeBasename = (name: string): string => name.replace(/[\\/]/g, '_')

export const writeStdinToTempFile = async ({
  filename,
  stdin = process.stdin,
}: {
  filename: string
  stdin?: NodeJS.ReadableStream
}): Promise<{ filePath: string; cleanup: () => Promise<void> }> => {
  const raw = typeof filename === 'string' ? filename.trim() : ''
  if (!raw) throw new CliError('Missing --filename (required with --file -)', 2)

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'shop-cli-stdin-'))
  const cleanup = async () => {
    await rm(tempDir, { recursive: true, force: true })
  }

  try {
    const filePath = path.join(tempDir, safeBasename(raw) || 'stdin')
    const out = createWriteStream(filePath)
    await pipeline(stdin as any, out as any)
    return { filePath, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}

