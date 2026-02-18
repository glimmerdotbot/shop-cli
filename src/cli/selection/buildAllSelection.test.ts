import { describe, it, expect } from 'vitest'

import { getFields } from '../introspection'
import { buildAllSelection, validateIncludes } from './buildAllSelection'

describe('validateIncludes', () => {
  it('throws on unknown fields', () => {
    expect(() => validateIncludes('Product', ['__definitely_not_a_field__'])).toThrow(/Unknown field/)
  })

  it('throws when including a non-connection field', () => {
    const fields = getFields('Product')
    const scalar = fields.find((f) => f.isScalar && !f.hasRequiredArgs)
    if (!scalar) return
    expect(() => validateIncludes('Product', [scalar.name])).toThrow(/not a connection field/i)
  })

  it('accepts a valid connection field', () => {
    const fields = getFields('Product')
    const connection = fields.find((f) => f.isConnection && !f.hasRequiredArgs)
    if (!connection) return
    expect(() => validateIncludes('Product', [connection.name])).not.toThrow()
  })
})

describe('buildAllSelection', () => {
  it('does not include connections by default', () => {
    const fields = getFields('Product')
    const connection = fields.find((f) => f.isConnection && !f.hasRequiredArgs)
    if (!connection) return

    const sel = buildAllSelection('Product')
    expect(sel).not.toHaveProperty(connection.name)
  })

  it('includes requested connections with nodes and pageInfo', () => {
    const fields = getFields('Product')
    const connection = fields.find((f) => f.isConnection && !f.hasRequiredArgs)
    if (!connection) return

    const sel = buildAllSelection('Product', [connection.name])
    expect(sel).toHaveProperty(connection.name)
    const connSel: any = (sel as any)[connection.name]
    expect(connSel).toHaveProperty('__args')
    expect(connSel.__args).toHaveProperty('first')
    expect(connSel).toHaveProperty('pageInfo')
    expect(connSel.pageInfo).toHaveProperty('hasNextPage')
    expect(connSel.pageInfo).toHaveProperty('endCursor')
    expect(connSel.nodes ?? connSel.edges).toBeTruthy()
  })

  it('skips fields with required arguments', () => {
    const fields = getFields('Product')
    const requiredArgField = fields.find((f) => f.hasRequiredArgs && !f.isConnection && !f.isScalar)
    if (!requiredArgField) return

    const sel = buildAllSelection('Product')
    expect(sel).not.toHaveProperty(requiredArgField.name)
  })
})

