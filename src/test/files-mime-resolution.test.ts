import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildLocalFilesForStagedUpload } from '../cli/workflows/files/stagedUploads'

const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAwMB/6Xw6QAAAABJRU5ErkJggg==',
  'base64',
)

describe('MIME resolution precedence', () => {
  it('uses explicit --mime-type over sniffed type', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'shop-cli-mime-test-'))
    try {
      const filePath = path.join(dir, 'cat.png')
      await writeFile(filePath, MIN_PNG)

      const [local] = await buildLocalFilesForStagedUpload({
        filePaths: [filePath],
        mimeType: 'text/plain',
      })

      expect(local!.mimeType).toBe('text/plain')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('uses sniffed type over extension', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'shop-cli-mime-test-'))
    try {
      const filePath = path.join(dir, 'cat.txt')
      // Valid PNG bytes, but misleading extension
      await writeFile(filePath, MIN_PNG)

      const [local] = await buildLocalFilesForStagedUpload({ filePaths: [filePath] })
      expect(local!.mimeType).toBe('image/png')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('falls back to extension when sniffing is unknown', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'shop-cli-mime-test-'))
    try {
      const filePath = path.join(dir, 'hello.txt')
      await writeFile(filePath, 'hello')

      const [local] = await buildLocalFilesForStagedUpload({ filePaths: [filePath] })
      expect(local!.mimeType).toBe('text/plain')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('errors when MIME cannot be determined', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'shop-cli-mime-test-'))
    try {
      const filePath = path.join(dir, 'hello.unknownext')
      await writeFile(filePath, 'hello')

      await expect(buildLocalFilesForStagedUpload({ filePaths: [filePath] })).rejects.toMatchObject({
        message: expect.stringContaining('--mime-type'),
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
