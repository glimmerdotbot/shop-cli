import { describe, expect, it, beforeEach, afterEach } from 'vitest'

describe('products media remove output', () => {
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

  it('returns { productId, removedMediaIds } and --quiet prints removed media IDs', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            fileUpdate: {
              files: [{ id: 'gid://shopify/MediaImage/10' }, { id: 'gid://shopify/Video/11' }],
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
      verb: 'media remove',
      argv: [
        '--id',
        'gid://shopify/Product/1',
        '--media-id',
        'gid://shopify/MediaImage/10',
        '--media-id',
        'gid://shopify/Video/11',
      ],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toEqual({
      productId: 'gid://shopify/Product/1',
      removedMediaIds: ['gid://shopify/MediaImage/10', 'gid://shopify/Video/11'],
    })

    captured = ''
    ctx.quiet = true

    await runProducts({
      ctx,
      verb: 'media remove',
      argv: [
        '--id',
        'gid://shopify/Product/1',
        '--media-id',
        'gid://shopify/MediaImage/10',
        '--media-id',
        'gid://shopify/Video/11',
      ],
    })

    expect(captured).toBe('gid://shopify/MediaImage/10\ngid://shopify/Video/11\n')
  })
})

