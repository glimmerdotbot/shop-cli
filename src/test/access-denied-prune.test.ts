import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GenqlError } from '../generated/admin-2026-04'
import { runQuery, type CommandContext } from '../cli/router'

describe('view all access-denied pruning', () => {
  const originalErrWrite = process.stderr.write.bind(process.stderr)
  let stderr = ''
  let consoleErrors: string[] = []
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined

  beforeEach(() => {
    stderr = ''
    consoleErrors = []
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      consoleErrors.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    })
    ;(process.stderr as any).write = (chunk: unknown) => {
      stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
    ;(process.stderr as any).write = originalErrWrite
  })

  it('prunes ACCESS_DENIED fields and retries for --view all', async () => {
    const calls: any[] = []
    const client = {
      query: async (req: any) => {
        calls.push(JSON.parse(JSON.stringify(req)))
        if (calls.length === 1) {
          throw new GenqlError(
            [
              {
                message:
                  'Access denied for resourcePublicationOnCurrentPublication field. Required access: `read_product_listings` access scope.',
                path: ['product', 'resourcePublicationOnCurrentPublication'],
                extensions: {
                  code: 'ACCESS_DENIED',
                  requiredAccess: '`read_product_listings` access scope.',
                },
              },
              {
                message:
                  'Access denied for publishedOnCurrentChannel field. Required access: `read_product_listings` access scope.',
                path: ['product', 'publishedOnCurrentChannel'],
                extensions: {
                  code: 'ACCESS_DENIED',
                  requiredAccess: '`read_product_listings` access scope.',
                },
              },
            ],
            { product: null },
          )
        }
        return { product: { id: 'gid://shopify/Product/1' } }
      },
    }

    const ctx: CommandContext = {
      client: client as any,
      format: 'json',
      quiet: false,
      view: 'all',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    const request = {
      product: {
        __args: { id: 'gid://shopify/Product/1' },
        id: true,
        publishedOnCurrentChannel: true,
        resourcePublicationOnCurrentPublication: { isPublished: true },
      },
    }

    const result = await runQuery(ctx, request)
    expect(result.product.id).toBe('gid://shopify/Product/1')

    expect(calls).toHaveLength(2)
    expect(calls[0].product.publishedOnCurrentChannel).toBe(true)
    expect(calls[0].product.resourcePublicationOnCurrentPublication).toBeDefined()
    expect(calls[1].product.publishedOnCurrentChannel).toBeUndefined()
    expect(calls[1].product.resourcePublicationOnCurrentPublication).toBeUndefined()

    const combined = consoleErrors.join('\n')
    expect(combined).toContain('Omitted 2 access-denied field(s):')
    expect(combined).toContain('product.resourcePublicationOnCurrentPublication')
    expect(combined).toContain('product.publishedOnCurrentChannel')
  })

  it('does not emit pruning warnings when --quiet is set', async () => {
    let call = 0
    const client = {
      query: async (_req: any) => {
        call++
        if (call === 1) {
          throw new GenqlError(
            [
              {
                message:
                  'Access denied for publishedOnCurrentChannel field. Required access: `read_product_listings` access scope.',
                path: ['product', 'publishedOnCurrentChannel'],
                extensions: { code: 'ACCESS_DENIED', requiredAccess: '`read_product_listings` access scope.' },
              },
            ],
            { product: null },
          )
        }
        return { product: { id: 'gid://shopify/Product/1' } }
      },
    }

    const ctx: CommandContext = {
      client: client as any,
      format: 'json',
      quiet: true,
      view: 'all',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    const request = {
      product: {
        __args: { id: 'gid://shopify/Product/1' },
        id: true,
        publishedOnCurrentChannel: true,
      },
    }

    const result = await runQuery(ctx, request)
    expect(result.product.id).toBe('gid://shopify/Product/1')
    expect(consoleErrors.join('\n')).toBe('')
  })
})
