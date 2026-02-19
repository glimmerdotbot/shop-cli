import { describe, expect, it, beforeEach, afterEach } from 'vitest'

describe('products bundle-create|bundle-update output', () => {
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

  it('returns product as the primary output and includes operation context', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const capture: { request?: any } = {}
    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          capture.request = request
          return {
            productBundleCreate: {
              productBundleOperation: {
                id: 'gid://shopify/ProductBundleOperation/1',
                status: 'PENDING',
                product: { id: 'gid://shopify/Product/99', title: 'Bundle' },
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
      verb: 'bundle-create',
      argv: ['--input', '{}'],
    })

    expect(capture.request?.productBundleCreate?.productBundleOperation?.product?.id).toBe(true)

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      id: 'gid://shopify/Product/99',
      title: 'Bundle',
      operation: { id: 'gid://shopify/ProductBundleOperation/1', status: 'PENDING' },
    })
  })

  it('--quiet prints the product ID (not the operation ID)', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            productBundleUpdate: {
              productBundleOperation: {
                id: 'gid://shopify/ProductBundleOperation/2',
                status: 'PENDING',
                product: { id: 'gid://shopify/Product/123' },
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
      verb: 'bundle-update',
      argv: ['--input', '{}'],
    })

    expect(captured).toBe('gid://shopify/Product/123\n')
  })
})

