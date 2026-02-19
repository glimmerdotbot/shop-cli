import { describe, expect, it, beforeEach, afterEach } from 'vitest'

describe('product-variants bulk outputs', () => {
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

  it('bulk-create returns created variants as the primary output', async () => {
    const { runProductVariants } = await import('../cli/verbs/product-variants')

    const capture: { request?: any } = {}
    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          capture.request = request
          return {
            productVariantsBulkCreate: {
              productVariants: [
                { id: 'gid://shopify/ProductVariant/1', displayName: 'Variant 1' },
                { id: 'gid://shopify/ProductVariant/2', displayName: 'Variant 2' },
              ],
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

    await runProductVariants({
      ctx,
      verb: 'bulk-create',
      argv: ['--product-id', 'gid://shopify/Product/9', '--input', '[]'],
    })

    expect(capture.request?.productVariantsBulkCreate?.productVariants?.id).toBe(true)

    const out = JSON.parse(captured.trim())
    expect(out.nodes).toHaveLength(2)
    expect(out.nodes[0]).toMatchObject({ id: 'gid://shopify/ProductVariant/1', productId: 'gid://shopify/Product/9' })
    expect(out.nodes[1]).toMatchObject({ id: 'gid://shopify/ProductVariant/2', productId: 'gid://shopify/Product/9' })
  })

  it('append-media returns affected variants and supports --quiet', async () => {
    const { runProductVariants } = await import('../cli/verbs/product-variants')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            productVariantAppendMedia: {
              productVariants: [{ id: 'gid://shopify/ProductVariant/77' }],
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

    await runProductVariants({
      ctx,
      verb: 'append-media',
      argv: [
        '--id',
        'gid://shopify/ProductVariant/77',
        '--product-id',
        'gid://shopify/Product/9',
        '--media-ids',
        'gid://shopify/MediaImage/10',
      ],
    })

    expect(captured).toBe('gid://shopify/ProductVariant/77\n')
  })

  it('bulk-delete returns deleted variant IDs and --quiet prints them', async () => {
    const { runProductVariants } = await import('../cli/verbs/product-variants')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            productVariantsBulkDelete: { product: { id: 'gid://shopify/Product/9' }, userErrors: [] },
          }
        },
        query: async (request: any) => {
          // After delete, first variant is gone, second remains.
          if (request?.nodes?.__args?.ids) {
            return { nodes: [null, { id: 'gid://shopify/ProductVariant/2' }] }
          }
          throw new Error('Unexpected query in test')
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runProductVariants({
      ctx,
      verb: 'bulk-delete',
      argv: [
        '--product-id',
        'gid://shopify/Product/9',
        '--variant-ids',
        'gid://shopify/ProductVariant/1,gid://shopify/ProductVariant/2',
      ],
    })

    expect(captured).toBe('gid://shopify/ProductVariant/1\n')
  })
})

