import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { printConnection, printJson, printNode, setGlobalOutputFormat } from '../cli/output'

describe('output jsonl', () => {
  const originalWrite = process.stdout.write.bind(process.stdout)
  const originalErrWrite = process.stderr.write.bind(process.stderr)
  let stdout = ''
  let stderr = ''

  beforeEach(() => {
    stdout = ''
    stderr = ''
    setGlobalOutputFormat('json')
    ;(process.stdout as any).write = (chunk: unknown) => {
      stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
    ;(process.stderr as any).write = (chunk: unknown) => {
      stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    ;(process.stdout as any).write = originalWrite
    ;(process.stderr as any).write = originalErrWrite
    setGlobalOutputFormat('json')
  })

  it('forces compact JSON when format is jsonl', () => {
    setGlobalOutputFormat('jsonl')
    printJson({ a: 1, b: 2 }, true)
    expect(stdout).toBe('{"a":1,"b":2}\n')
  })

  it('prints a node as a single JSON line', () => {
    setGlobalOutputFormat('jsonl')
    printNode({ node: { id: 'gid://shopify/Product/1' }, format: 'jsonl', quiet: false })
    expect(stdout).toBe('{"id":"gid://shopify/Product/1"}\n')
  })

  it('prints a connection as JSONL (nodes + pageInfo)', () => {
    setGlobalOutputFormat('jsonl')
    printConnection({
      connection: {
        nodes: [{ id: '1', title: 'Hat' }, { id: '2' }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
      format: 'jsonl',
      quiet: false,
    })
    expect(stdout).toBe('{"id":"1","title":"Hat"}\n' + '{"id":"2"}\n')
    expect(stderr).toBe('')
  })

  it('prints next-page hint to stderr when hasNextPage is true', () => {
    setGlobalOutputFormat('jsonl')
    printConnection({
      connection: {
        nodes: [{ id: '1' }],
        pageInfo: { hasNextPage: true, endCursor: 'CURSOR' },
      },
      format: 'jsonl',
      quiet: false,
      nextPageArgs: { base: 'shop products list', first: 50 },
    })
    expect(stdout).toBe('{"id":"1"}\n')
    expect(stderr).toBe('Next page: shop products list --after "CURSOR"\n')
  })
})
