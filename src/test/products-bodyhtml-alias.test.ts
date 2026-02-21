import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('products bodyHtml alias', () => {
  let originalWrite: typeof process.stdout.write

  beforeEach(() => {
    originalWrite = process.stdout.write.bind(process.stdout)
    ;(process.stdout as any).write = () => true
  })

  afterEach(() => {
    ;(process.stdout as any).write = originalWrite
  })

  it('maps --set bodyHtml to descriptionHtml for products create', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const capture: { request?: any } = {}
    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          capture.request = request
          return { productCreate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } }
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
      verb: 'create',
      argv: ['--set', 'bodyHtml=<p>Hello</p>'],
    })

    const input = capture.request?.productCreate?.__args?.input
    expect(input?.descriptionHtml).toBe('<p>Hello</p>')
    expect(input?.bodyHtml).toBeUndefined()
  })

  it('maps --set bodyHtml to descriptionHtml for products update', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const capture: { request?: any } = {}
    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          capture.request = request
          return { productUpdate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } }
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
      verb: 'update',
      argv: ['--id', 'gid://shopify/Product/1', '--set', 'bodyHtml=<p>Updated</p>'],
    })

    const input = capture.request?.productUpdate?.__args?.input
    expect(input?.id).toBe('gid://shopify/Product/1')
    expect(input?.descriptionHtml).toBe('<p>Updated</p>')
    expect(input?.bodyHtml).toBeUndefined()
  })

  it('rejects conflicting bodyHtml and descriptionHtml', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const ctx: any = {
      client: {
        mutation: async () => {
          throw new Error('mutation should not be called')
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await expect(
      runProducts({
        ctx,
        verb: 'update',
        argv: [
          '--id',
          'gid://shopify/Product/1',
          '--set',
          'bodyHtml=<p>A</p>',
          '--set',
          'descriptionHtml=<p>B</p>',
        ],
      }),
    ).rejects.toThrowError('Conflicting bodyHtml and descriptionHtml; use descriptionHtml.')
  })
})
