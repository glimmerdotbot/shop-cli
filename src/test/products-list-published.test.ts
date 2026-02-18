import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../cli/router'
import { runProducts } from '../cli/verbs/products'

describe('products list --published', () => {
  const makeCtx = (capture: { request?: any }): CommandContext =>
    ({
      client: {
        query: async (request: any) => {
          capture.request = request
          return {
            products: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
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
    }) as any

  it('sets query to published_status:published when no --query is provided', async () => {
    const capture: { request?: any } = {}
    const ctx = makeCtx(capture)

    await runProducts({ ctx, verb: 'list', argv: ['--published'] })

    expect(capture.request?.products?.__args?.query).toBe('published_status:published')
  })

  it('appends published filter to existing --query', async () => {
    const capture: { request?: any } = {}
    const ctx = makeCtx(capture)

    await runProducts({ ctx, verb: 'list', argv: ['--query', 'status:active', '--published'] })

    expect(capture.request?.products?.__args?.query).toBe(
      'status:active published_status:published',
    )
  })

  it('does not duplicate published filter if already present in --query', async () => {
    const capture: { request?: any } = {}
    const ctx = makeCtx(capture)

    await runProducts({
      ctx,
      verb: 'list',
      argv: ['--query', 'published_status:published status:active', '--published'],
    })

    expect(capture.request?.products?.__args?.query).toBe(
      'published_status:published status:active',
    )
  })
})

