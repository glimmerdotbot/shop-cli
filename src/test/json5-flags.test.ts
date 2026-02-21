import { describe, expect, it } from 'vitest'

import { parseHeadersFromEnv } from '../cli/headers'
import { buildInput } from '../cli/input'
import { parseJsonArg } from '../cli/verbs/_shared'

describe('json5 parsing for json-ish flags', () => {
  it('parses JSON5 in --set values that look like JSON', () => {
    const built = buildInput({
      setArgs: ["options=[{name:'Size',values:['a','b'],},]"],
    })
    expect(built.used).toBe(true)
    expect(built.input).toEqual({
      options: [{ name: 'Size', values: ['a', 'b'] }],
    })
  })

  it('parses JSON5 in --input', () => {
    const built = buildInput({
      inputArg: "{foo:'bar',}",
    })
    expect(built.used).toBe(true)
    expect(built.input).toEqual({ foo: 'bar' })
  })

  it('parses JSON5 in parseJsonArg()', () => {
    expect(parseJsonArg("{foo:'bar'}", '--input')).toEqual({ foo: 'bar' })
  })

  it('parses JSON5 in SHOPIFY_HEADERS env', () => {
    expect(parseHeadersFromEnv("{'X-Foo':'bar'}")).toEqual({ 'X-Foo': 'bar' })
  })
})

