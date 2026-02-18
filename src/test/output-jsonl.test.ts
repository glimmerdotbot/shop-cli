import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { printConnection, printJson, printNode, setGlobalOutputFormat } from '../cli/output'

describe('output jsonl', () => {
  const originalWrite = process.stdout.write.bind(process.stdout)
  let stdout = ''

  beforeEach(() => {
    stdout = ''
    setGlobalOutputFormat('json')
    ;(process.stdout as any).write = (chunk: unknown) => {
      stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    ;(process.stdout as any).write = originalWrite
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
    expect(stdout).toBe(
      '{"id":"1","title":"Hat"}\n' +
        '{"id":"2"}\n' +
        '{"pageInfo":{"hasNextPage":false,"endCursor":null}}\n',
    )
  })
})

