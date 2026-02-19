import { describe, expect, it } from 'vitest'

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const runCli = (args: string[]) => {
  const repoRoot = process.cwd()
  const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const cliEntry = path.join(repoRoot, 'src', 'cli.ts')

  return spawnSync(process.execPath, [tsxCli, cliEntry, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SHOP_CLI_COMMAND: 'shop',
      FORCE_COLOR: '0',
    },
    encoding: 'utf8',
  })
}

describe('did-you-mean suggestions', () => {
  it('suggests resources without printing help', () => {
    const result = runCli(['product'])
    expect(result.status).toBe(2)
    expect(result.stdout.trim()).toBe('')
    expect(result.stderr).toContain('Unknown resource: product')
    expect(result.stderr).toContain('Did you mean:')
    const iProducts = result.stderr.indexOf('  shop products\n')
    const iProductFeeds = result.stderr.indexOf('  shop product-feeds\n')
    const iProductVariants = result.stderr.indexOf('  shop product-variants\n')
    expect(iProducts).toBeGreaterThanOrEqual(0)
    expect(iProductFeeds).toBeGreaterThanOrEqual(0)
    expect(iProductVariants).toBeGreaterThanOrEqual(0)
    expect(iProducts).toBeLessThan(iProductFeeds)
    expect(iProducts).toBeLessThan(iProductVariants)
  })

  it('suggests corrected resource while preserving the rest', () => {
    const result = runCli(['product', 'options', '--dry-run'])
    expect(result.status).toBe(2)
    expect(result.stdout.trim()).toBe('')
    expect(result.stderr).toContain('Unknown resource: product')
    expect(result.stderr).toContain('Did you mean:')
    expect(result.stderr).toContain('  shop products options --dry-run')
  })

  it('suggests corrected verb group', () => {
    const result = runCli(['products', 'option', '--dry-run'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Unknown verb for products: option')
    expect(result.stderr).toContain('Did you mean:')
    expect(result.stderr).toContain('  shop products options')
  })

  it('suggests corrected multi-verb', () => {
    const result = runCli(['products', 'media', 'uploads', '--dry-run'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Unknown verb for products: media uploads')
    expect(result.stderr).toContain('Did you mean:')
    expect(result.stderr).toContain('  shop products media upload')
  })
})

describe('validation errors include a help pointer', () => {
  it('adds See help for missing flags', () => {
    const result = runCli(['products', 'media', 'upload', '--dry-run'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Missing --product-id')
    expect(result.stderr).toContain('See help:')
    expect(result.stderr).toContain('  shop products media upload --help')
  })
})
