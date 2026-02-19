import { describe, expect, it } from 'vitest'

import { buildMissingIdHint, buildUnexpectedPositionalHint, parseVerbAndRest } from '../cli/parse-command'

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

  it('builds a helpful missing --id hint for positional IDs', () => {
    const msg = buildMissingIdHint({
      command: 'shop',
      resource: 'products',
      verb: 'get',
      rest: ['7815068024874'],
    })
    expect(msg).toBe(
      'Missing --id <ID>\nDid you mean:\n  shop products get --id 7815068024874',
    )
  })

  it('uses the configured command name in the suggested command', () => {
    const msg = buildMissingIdHint({
      command: 'shopcli',
      resource: 'products',
      verb: 'get',
      rest: ['7815068024874'],
    })
    expect(msg).toBe(
      'Missing --id <ID>\nDid you mean:\n  shopcli products get --id 7815068024874',
    )
  })

  it('does not build a hint when --id is already present', () => {
    const msg = buildMissingIdHint({
      command: 'shop',
      resource: 'products',
      verb: 'get',
      rest: ['--id', '7815068024874'],
    })
    expect(msg).toBeUndefined()
  })

  it('does not build a hint for non-ID positionals', () => {
    const msg = buildMissingIdHint({
      command: 'shop',
      resource: 'products',
      verb: 'get',
      rest: ['not-an-id'],
    })
    expect(msg).toBeUndefined()
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
