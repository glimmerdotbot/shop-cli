import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import { applyComputedFieldsToNode } from '../cli/output/computedFields'
import { printNode } from '../cli/output'
import { runCommandDryRun } from './graphql/runDryRun'

describe('products publications computed field', () => {
  it('adds [publications] and strips resourcePublicationsV2 for summary view', () => {
    const node = {
      id: 'gid://shopify/Product/1',
      title: 'Test',
      resourcePublicationsV2: {
        nodes: [
          {
            isPublished: true,
            publishDate: '2026-02-18T15:33:22Z',
            publication: {
              id: 'gid://shopify/Publication/1',
              catalog: {
                title: 'Online Store',
                on_AppCatalog: { apps: { nodes: [{ title: 'Online Store' }] } },
              },
            },
          },
        ],
      },
    }

    const out = applyComputedFieldsToNode(node, { view: 'summary' }) as any
    expect(out.resourcePublicationsV2).toBeUndefined()
    expect(out['[publications]']).toEqual([
      { isPublished: true, title: 'Online Store', publishDate: '2026-02-18T15:33:22Z' },
    ])
  })

  it('keeps resourcePublicationsV2 for all view', () => {
    const node = {
      id: 'gid://shopify/Product/1',
      resourcePublicationsV2: { nodes: [] as any[] },
    }
    const out = applyComputedFieldsToNode(node, { view: 'all' }) as any
    expect(out.resourcePublicationsV2).toBeDefined()
    expect(out['[publications]']).toEqual([])
  })

  describe('formatting', () => {
    let captured = ''
    let originalWrite: typeof process.stdout.write

    beforeEach(() => {
      originalWrite = process.stdout.write.bind(process.stdout)
      ;(process.stdout as any).write = (chunk: unknown) => {
        captured +=
          typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
        return true
      }
    })

    afterEach(() => {
      ;(process.stdout as any).write = originalWrite
      captured = ''
    })

    it('prints markdown publications section', () => {
      printNode({
        quiet: false,
        format: 'markdown',
        node: {
          id: 'gid://shopify/Product/1',
          title: 'Test',
          ['[publications]']: [
            {
              isPublished: true,
              title: 'Online Store',
              publishDate: '2026-02-18T15:33:22Z',
            },
          ],
        },
      })

      expect(captured).toContain('## [publications]')
      expect(captured).toContain('### Online Store')
      expect(captured).toContain('- isPublished: true')
      expect(captured).toContain('- publishDate: 2026-02-18T15:33:22Z')
    })

    it('prints table-friendly publications cell', () => {
      printNode({
        quiet: false,
        format: 'table',
        node: {
          id: 'gid://shopify/Product/1',
          title: 'Test',
          ['[publications]']: [
            {
              isPublished: true,
              title: 'Online Store',
              publishDate: '2026-02-18T15:33:22Z',
            },
          ],
        },
      })

      expect(captured).toContain('[publications]')
      expect(captured).toContain('Online Store published 2026-02-18T15:33:22Z')
    })
  })

  it('includes publications selection in products get dry-run (summary)', async () => {
    const printed = await runCommandDryRun({
      resource: 'products',
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

  it('includes publications connection in products get dry-run (all)', async () => {
    const printed = await runCommandDryRun({
      resource: 'products',
      verb: 'get',
      argv: ['--id', '123'],
      view: 'all',
    })

    expect(printed.length).toBeGreaterThan(0)
    const query = printed[0]!.query
    expect(query).toContain('resourcePublicationsV2')
  })
})
