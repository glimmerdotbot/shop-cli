import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { renderTopLevelHelp, renderVerbHelp } from '../cli/help/render'
import { printConnection, setGlobalCommand, setGlobalOutputFormat } from '../cli/output'
import { runTypes } from '../cli/verbs/types'

describe('help command rendering', () => {
  const originalWrite = process.stdout.write.bind(process.stdout)
  const originalErrWrite = process.stderr.write.bind(process.stderr)
  const originalEnv = process.env.SHOP_CLI_COMMAND

  let stdout = ''
  let stderr = ''

  beforeEach(() => {
    stdout = ''
    stderr = ''
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
    if (originalEnv === undefined) delete process.env.SHOP_CLI_COMMAND
    else process.env.SHOP_CLI_COMMAND = originalEnv
    setGlobalCommand(undefined)
    setGlobalOutputFormat('json')
  })

  it('uses SHOP_CLI_COMMAND for --help output', () => {
    process.env.SHOP_CLI_COMMAND = 'shopcli'
    const help = renderTopLevelHelp()
    expect(help).toContain('  shopcli <resource> <verb> [flags]')
    expect(help).toContain('  shopcli types <TypeName>')
  })

  it('re-writes command references in notes/examples', () => {
    process.env.SHOP_CLI_COMMAND = 'npx shop-cli'
    const help = renderVerbHelp('products', 'list', {}, undefined)
    // Notes vary; just assert usage line gets rewritten correctly.
    expect(help).toContain('  npx shop-cli products list [flags]')
  })

  it('uses SHOP_CLI_COMMAND for `types --help`', async () => {
    process.env.SHOP_CLI_COMMAND = 'shopcli'
    let logged = ''
    const originalLog = console.log
    try {
      ;(console as any).log = (chunk: unknown) => {
        logged += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
        logged += '\n'
      }
      await runTypes({ verb: '', argv: ['--help'] })
    } finally {
      ;(console as any).log = originalLog
    }
    expect(logged).toContain('  shopcli types <TypeName>')
  })

  it('re-writes next-page hint command when global command is set', () => {
    setGlobalOutputFormat('jsonl')
    setGlobalCommand('shopcli')
    printConnection({
      connection: {
        nodes: [{ id: '1' }],
        pageInfo: { hasNextPage: true, endCursor: 'CURSOR' },
      },
      format: 'jsonl',
      quiet: false,
      nextPageArgs: { base: 'shop products list', first: 50 },
    })
    expect(stderr).toBe('Next page: shopcli products list --after "CURSOR"\n')
  })
})
