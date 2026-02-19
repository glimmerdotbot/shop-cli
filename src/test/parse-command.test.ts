import { describe, expect, it } from 'vitest'

import { buildUnexpectedPositionalHint, parseVerbAndRest, rewritePositionalIdAsFlag } from '../cli/parse-command'

describe('parse-command', () => {
  it('parses a known single-word verb and leaves positionals in rest', () => {
    const parsed = parseVerbAndRest({
      resource: 'products',
      afterResource: ['get', '7815068024874'],
    })
    expect(parsed).toEqual({ verb: 'get', rest: ['7815068024874'] })
  })

  it('parses a known multi-word verb', () => {
    const parsed = parseVerbAndRest({
      resource: 'products',
      afterResource: ['media', 'add', '--id', '123'],
    })
    expect(parsed).toEqual({ verb: 'media add', rest: ['--id', '123'] })
  })

  it('keeps legacy behavior when verb is unknown', () => {
    const parsed = parseVerbAndRest({
      resource: 'products',
      afterResource: ['definitely-not-a-verb', '123'],
    })
    expect(parsed).toEqual({ verb: 'definitely-not-a-verb 123', rest: [] })
  })

  it('keeps legacy behavior for graphql so queries can be embedded in the verb', () => {
    const parsed = parseVerbAndRest({
      resource: 'graphql',
      afterResource: ['query', '{', 'shop', '{', 'name', '}', '}'],
    })
    expect(parsed).toEqual({ verb: 'query { shop { name } }', rest: [] })
  })

  it('rewrites positional numeric IDs to --id for verbs that support it', () => {
    const rewritten = rewritePositionalIdAsFlag({
      resource: 'products',
      verb: 'get',
      rest: ['7815068024874'],
    })
    expect(rewritten).toEqual(['--id', '7815068024874'])
  })

  it('rewrites positional gid://shopify/... IDs case-insensitively', () => {
    const rewritten = rewritePositionalIdAsFlag({
      resource: 'products',
      verb: 'get',
      rest: ['GID://SHOPIFY/Product/7815068024874'],
    })
    expect(rewritten).toEqual(['--id', 'GID://SHOPIFY/Product/7815068024874'])
  })

  it('does not rewrite when --id is already present', () => {
    const rewritten = rewritePositionalIdAsFlag({
      resource: 'products',
      verb: 'get',
      rest: ['--id', '7815068024874'],
    })
    expect(rewritten).toEqual(['--id', '7815068024874'])
  })

  it('does not rewrite for verbs that do not support --id', () => {
    const rewritten = rewritePositionalIdAsFlag({
      resource: 'products',
      verb: 'list',
      rest: ['7815068024874'],
    })
    expect(rewritten).toEqual(['7815068024874'])
  })

  it('builds a generic hint for unexpected positionals on known verbs', () => {
    const msg = buildUnexpectedPositionalHint({
      command: 'shop',
      resource: 'products',
      verb: 'list',
      rest: ['ACTIVE'],
    })
    expect(msg).toBe(
      'Unexpected argument: `ACTIVE`.\nThis command only accepts flags. See `shop products list --help`.',
    )
  })
})
