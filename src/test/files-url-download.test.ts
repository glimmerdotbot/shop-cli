import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { downloadUrlsToTempDir } from '../cli/workflows/files/urlDownloads'

const listen = async () => {
  const server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400
      res.end('missing url')
      return
    }
    if (req.url.startsWith('/assets/cat.png')) {
      res.statusCode = 200
      res.setHeader('content-type', 'image/png')
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      return
    }
    if (req.url.startsWith('/hello.txt')) {
      res.statusCode = 200
      res.setHeader('content-type', 'text/plain')
      res.end('hello')
      return
    }
    res.statusCode = 404
    res.end('not found')
  })

  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected server address object')
  const baseUrl = `http://127.0.0.1:${address.port}`

  return { server, baseUrl }
}

describe('downloadUrlsToTempDir', () => {
  it('streams downloads to disk and cleans up temp dir', async () => {
    const { server, baseUrl } = await listen()
    try {
      const { tempDir, files, cleanup } = await downloadUrlsToTempDir({
        urls: [`${baseUrl}/assets/cat.png?x=1`],
      })

      expect(files).toHaveLength(1)
      expect(files[0]!.filename).toBe('cat.png')

      const bytes = await readFile(files[0]!.filePath)
      expect(bytes.slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))

      await cleanup()
      expect(existsSync(tempDir)).toBe(false)
    } finally {
      server.close()
    }
  })

  it('supports --filename override for a single URL', async () => {
    const { server, baseUrl } = await listen()
    try {
      const { files, cleanup } = await downloadUrlsToTempDir({
        urls: [`${baseUrl}/hello.txt`],
        filenameOverride: 'greeting.txt',
      })
      expect(files).toHaveLength(1)
      expect(files[0]!.filename).toBe('greeting.txt')
      expect(String(await readFile(files[0]!.filePath, 'utf8'))).toBe('hello')
      await cleanup()
    } finally {
      server.close()
    }
  })
})

