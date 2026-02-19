import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => {
  return { spawn: vi.fn() }
})

describe('streaming staged upload (curl)', () => {
  it('invokes curl with expected multipart args', async () => {
    const { spawn } = await import('node:child_process')
    const spawnMock = vi.mocked(spawn)

    spawnMock.mockImplementation((_cmd: any, _args: any, _opts: any) => {
      const child = new EventEmitter() as any
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      queueMicrotask(() => child.emit('close', 0))
      return child
    })

    const { uploadToStagedTarget } = await import('../cli/workflows/files/stagedUploads')

    await uploadToStagedTarget({
      target: {
        url: 'https://staged.example/upload',
        resourceUrl: 'https://staged.example/resource',
        parameters: [
          { name: 'key', value: 'abc' },
          { name: 'policy', value: 'p123' },
        ],
      },
      localFile: {
        filePath: '/tmp/cat.png',
        filename: 'cat.png',
        mimeType: 'image/png',
        resource: 'IMAGE',
        fileSize: 8,
      },
    })

    expect(spawnMock).toHaveBeenCalledTimes(1)

    const [cmd, args, opts] = spawnMock.mock.calls[0]!
    expect(cmd).toBe('curl')
    expect(Array.isArray(args)).toBe(true)
    expect(args).toEqual(
      expect.arrayContaining([
        '--form-string',
        'key=abc',
        '--form-string',
        'policy=p123',
        '--form',
        expect.stringContaining('file=@/tmp/cat.png;type=image/png;filename=cat.png'),
        'https://staged.example/upload',
      ]),
    )
    expect(opts).toMatchObject({ stdio: ['ignore', 'pipe', 'pipe'] })
  })
})

