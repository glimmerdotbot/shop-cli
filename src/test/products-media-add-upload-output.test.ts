import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../cli/workflows/files/stagedUploads', async (importOriginal) => {
  const actual: any = await importOriginal()

  return {
    ...actual,
    stagedUploadLocalFiles: vi.fn(async (_ctx: any, localFiles: any[]) => {
      return localFiles.map((f, i) => ({
        url: `https://staged.example/upload/${i}`,
        resourceUrl: `https://staged.example/resource/${encodeURIComponent(f.filename ?? `file-${i}`)}`,
        parameters: [],
      }))
    }),
  }
})

describe('products media add|upload output', () => {
  let captured = ''
  let originalWrite: typeof process.stdout.write

  beforeEach(() => {
    captured = ''
    originalWrite = process.stdout.write.bind(process.stdout)
    ;(process.stdout as any).write = (chunk: unknown) => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    ;(process.stdout as any).write = originalWrite
    captured = ''
  })

  it('media add outputs the newly added media items (not the mutation payload)', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const capture: { request?: any } = {}
    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          capture.request = request
          return {
            productUpdate: {
              product: {
                media: {
                  nodes: [
                    {
                      id: 'gid://shopify/MediaImage/10',
                      mediaContentType: 'IMAGE',
                      status: 'READY',
                      alt: 'Orchids',
                    },
                  ],
                },
              },
              userErrors: [],
            },
          }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runProducts({
      ctx,
      verb: 'media add',
      argv: [
        '--id',
        'gid://shopify/Product/1',
        '--url',
        'https://example.com/orchids.jpg',
        '--alt',
        'Orchids',
      ],
    })

    expect(capture.request?.productUpdate?.product?.media?.__args?.last).toBe(1)
    expect(capture.request?.productUpdate?.product?.media?.__args?.sortKey).toBe('POSITION')
    expect(capture.request?.productUpdate?.product?.media?.nodes?.id).toBe(true)

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      nodes: [
        {
          id: 'gid://shopify/MediaImage/10',
          mediaContentType: 'IMAGE',
        },
      ],
    })
  })

  it('media add respects --quiet by outputting media IDs', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            productUpdate: {
              product: {
                media: { nodes: [{ id: 'gid://shopify/MediaImage/10' }] },
              },
              userErrors: [],
            },
          }
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runProducts({
      ctx,
      verb: 'media add',
      argv: ['--id', 'gid://shopify/Product/1', '--url', 'https://example.com/orchids.jpg'],
    })

    expect(captured).toBe('gid://shopify/MediaImage/10\n')
  })

  it('media upload outputs the newly uploaded media items (not the mutation payload)', async () => {
    const { runProducts } = await import('../cli/verbs/products')
    const { stagedUploadLocalFiles } = await import('../cli/workflows/files/stagedUploads')

    const stagedMock = vi.mocked(stagedUploadLocalFiles)
    stagedMock.mockClear()

    const capture: { request?: any } = {}
    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          capture.request = request
          return {
            productUpdate: {
              product: {
                media: { nodes: [{ id: 'gid://shopify/MediaImage/99', mediaContentType: 'IMAGE', status: 'READY' }] },
              },
              userErrors: [],
            },
          }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runProducts({
      ctx,
      verb: 'media upload',
      argv: [
        '--id',
        'gid://shopify/Product/1',
        '--file',
        'src/test/fixtures/sample.txt',
        '--content-type',
        'image/jpeg',
      ],
    })

    expect(stagedMock).toHaveBeenCalledTimes(1)
    expect(capture.request?.productUpdate?.product?.media?.__args?.last).toBe(1)
    expect(capture.request?.productUpdate?.product?.media?.nodes?.id).toBe(true)

    const out = JSON.parse(captured.trim())
    expect(out.nodes?.[0]?.id).toBe('gid://shopify/MediaImage/99')
  })
})
