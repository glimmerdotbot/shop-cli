import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { writeStdinToTempFile } from '../cli/workflows/files/stdinFile'

describe('stdin file spooling', () => {
  it('writes stdin to a temp file using the provided filename', async () => {
    const stdin = Readable.from([Buffer.from('hello')])
    const { filePath, cleanup } = await writeStdinToTempFile({ filename: 'greeting.txt', stdin })
    try {
      expect(path.basename(filePath)).toBe('greeting.txt')
      expect(String(await readFile(filePath, 'utf8'))).toBe('hello')
    } finally {
      await cleanup()
    }
  })
})

