import { describe, expect, it } from 'vitest'

import { pollFilesReadyOrFailed } from '../cli/workflows/files/waitForReady'

describe('--wait polling', () => {
  it('stops once all files are READY/FAILED', async () => {
    const ids = ['gid://shopify/File/1', 'gid://shopify/File/2']

    let call = 0
    const fetchNodes = async () => {
      call++
      if (call === 1) {
        return [
          { id: ids[0], fileStatus: 'UPLOADED' },
          { id: ids[1], fileStatus: 'FAILED' },
        ]
      }
      return [
        { id: ids[0], fileStatus: 'READY' },
        { id: ids[1], fileStatus: 'FAILED' },
      ]
    }

    let t = 0
    const now = () => t
    const sleep = async (ms: number) => {
      t += ms
    }

    const result = await pollFilesReadyOrFailed({
      ids,
      pollIntervalMs: 1000,
      timeoutMs: 10_000,
      fetchNodes,
      now,
      sleep,
    })

    expect(call).toBe(2)
    expect(result.readyIds).toEqual([ids[0]])
    expect(result.failedIds).toEqual([ids[1]])
  })

  it('times out with pending IDs', async () => {
    const ids = ['gid://shopify/File/1', 'gid://shopify/File/2']
    const fetchNodes = async () => [
      { id: ids[0], fileStatus: 'PROCESSING' },
      { id: ids[1], fileStatus: 'UPLOADED' },
    ]

    let t = 0
    const now = () => t
    const sleep = async (ms: number) => {
      t += ms
    }

    await expect(
      pollFilesReadyOrFailed({
        ids,
        pollIntervalMs: 1000,
        timeoutMs: 2500,
        fetchNodes,
        now,
        sleep,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining(ids[0]),
    })
  })
})

