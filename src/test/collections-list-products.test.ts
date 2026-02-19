import { describe, expect, it } from 'vitest'

import { CliError } from '../cli/errors'
import type { CommandContext } from '../cli/router'
import { runCollections } from '../cli/verbs/collections'

describe('collections list-products', () => {
  const makeCtx = (capture: { requests: any[] }): CommandContext =>
    ({
      client: {
        query: async (request: any) => {
          capture.requests.push(request)
          if (request?.collectionByHandle) {
            return {
              collectionByHandle: {
                id: 'gid://shopify/Collection/123',
              },
            }
          }
          if (request?.products) {
            return {
              products: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            }
          }
          throw new Error('Unexpected request shape')
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }) as any

  it('requires exactly one of --id or --handle', async () => {
    const capture: { requests: any[] } = { requests: [] }
    const ctx = makeCtx(capture)

    await expect(runCollections({ ctx, verb: 'list-products', argv: [] })).rejects.toThrow(CliError)
    await expect(
      runCollections({ ctx, verb: 'list-products', argv: ['--id', '123', '--handle', 'frontpage'] }),
    ).rejects.toThrow(/exactly one/i)
  })

  it('queries collection products by --id', async () => {
    const capture: { requests: any[] } = { requests: [] }
    const ctx = makeCtx(capture)

    await runCollections({ ctx, verb: 'list-products', argv: ['--id', '123'] })

    expect(capture.requests).toHaveLength(1)
    expect(capture.requests[0]?.products?.__args?.query).toBe('collection_id:123')
  })

  it('queries collection products by --handle', async () => {
    const capture: { requests: any[] } = { requests: [] }
    const ctx = makeCtx(capture)

    await runCollections({ ctx, verb: 'list-products', argv: ['--handle', 'frontpage'] })

    expect(capture.requests).toHaveLength(2)
    expect(capture.requests[0]?.collectionByHandle?.__args?.handle).toBe('frontpage')
    expect(capture.requests[1]?.products?.__args?.query).toBe('collection_id:123')
  })

  it('passes list flags through to products query', async () => {
    const capture: { requests: any[] } = { requests: [] }
    const ctx = makeCtx(capture)

    await runCollections({
      ctx,
      verb: 'list-products',
      argv: ['--id', '123', '--first', '10', '--after', 'CURSOR', '--sort', 'TITLE', '--reverse'],
    })

    const args = capture.requests[0]?.products?.__args
    expect(args?.first).toBe(10)
    expect(args?.after).toBe('CURSOR')
    expect(args?.sortKey).toBe('TITLE')
    expect(args?.reverse).toBe(true)
  })

  it('supports --published like products list', async () => {
    const capture: { requests: any[] } = { requests: [] }
    const ctx = makeCtx(capture)

    await runCollections({ ctx, verb: 'list-products', argv: ['--id', '123', '--published'] })
    expect(capture.requests[0]?.products?.__args?.query).toBe(
      'published_status:published collection_id:123',
    )

    await runCollections({
      ctx,
      verb: 'list-products',
      argv: ['--id', '123', '--query', 'status:active', '--published'],
    })
    expect(capture.requests[1]?.products?.__args?.query).toBe(
      'status:active published_status:published collection_id:123',
    )

    await runCollections({
      ctx,
      verb: 'list-products',
      argv: ['--id', '123', '--query', 'published_status:published status:active', '--published'],
    })
    expect(capture.requests[2]?.products?.__args?.query).toBe(
      'published_status:published status:active collection_id:123',
    )
  })
})
