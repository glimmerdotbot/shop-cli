import { describe, expect, it } from 'vitest'

import { runCommandDryRun } from './graphql/runDryRun'

describe('collections publications computed field', () => {
  it('includes publications selection in collections get dry-run (summary)', async () => {
    const printed = await runCommandDryRun({
      resource: 'collections',
      verb: 'get',
      argv: ['--id', '123'],
      view: 'summary',
    })

    expect(printed.length).toBeGreaterThan(0)
    const op = printed[0]!
    const query = op.query
    expect(query).toContain('resourcePublicationsV2')
    const match = query.match(/onlyPublished:\$(v\d+)/)
    expect(match?.[1]).toBeTruthy()
    expect((op.variables as any)?.[match![1]!]).toBe(false)
    expect(query).toContain('isPublished')
    expect(query).toContain('publishDate')
  })

  it('includes publications connection in collections get dry-run (all)', async () => {
    const printed = await runCommandDryRun({
      resource: 'collections',
      verb: 'get',
      argv: ['--id', '123'],
      view: 'all',
    })

    expect(printed.length).toBeGreaterThan(0)
    const query = printed[0]!.query
    expect(query).toContain('resourcePublicationsV2')
  })
})
