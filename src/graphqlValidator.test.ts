import { describe, it, expect } from 'vitest'
import { validateGraphQL, formatValidationErrors } from './graphqlValidator'

const API_VERSION = '2026-04'

describe('validateGraphQL', () => {
  describe('valid queries', () => {
    it('validates a simple query', () => {
      const result = validateGraphQL('{ shop { name } }', API_VERSION)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a query with multiple fields', () => {
      const result = validateGraphQL('{ shop { name id email } }', API_VERSION)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a named query with variables', () => {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
          }
        }
      `
      const result = validateGraphQL(query, API_VERSION)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a mutation', () => {
      const mutation = `
        mutation CreateProduct($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `
      const result = validateGraphQL(mutation, API_VERSION)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a query with nested connections', () => {
      const query = `
        query GetProducts {
          products(first: 10) {
            edges {
              node {
                id
                title
                variants(first: 5) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `
      const result = validateGraphQL(query, API_VERSION)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('invalid queries', () => {
    it('catches non-existent fields', () => {
      const result = validateGraphQL('{ shop { nonExistentField } }', API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Cannot query field "nonExistentField"')
    })

    it('catches multiple non-existent fields', () => {
      const result = validateGraphQL('{ shop { foo bar baz } }', API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })

    it('catches invalid argument types', () => {
      const result = validateGraphQL('{ products(first: "not_a_number") { edges { node { id } } } }', API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Int cannot represent non-integer value')
    })

    it('catches missing required arguments', () => {
      const result = validateGraphQL('{ product { id } }', API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('id')
    })

    it('catches syntax errors', () => {
      const result = validateGraphQL('{ shop { name', API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Syntax Error')
    })

    it('catches undefined variables', () => {
      const query = `
        query GetProduct {
          product(id: $undefinedVar) {
            id
          }
        }
      `
      const result = validateGraphQL(query, API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('undefinedVar')
    })

    it('catches wrong variable types', () => {
      const query = `
        query GetProducts($first: String!) {
          products(first: $first) {
            edges {
              node {
                id
              }
            }
          }
        }
      `
      const result = validateGraphQL(query, API_VERSION)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('first')
    })
  })

  describe('schema not found', () => {
    it('returns valid when schema file does not exist', () => {
      const result = validateGraphQL('{ shop { name } }', '9999-99')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})

describe('formatValidationErrors', () => {
  it('formats a single error without numbering', () => {
    const result = validateGraphQL('{ shop { fake } }', API_VERSION)
    const formatted = formatValidationErrors(result.errors)
    expect(formatted).not.toMatch(/^1\./)
    expect(formatted).toContain('Cannot query field "fake"')
    expect(formatted).toContain('line')
    expect(formatted).toContain('col')
  })

  it('formats multiple errors with numbering', () => {
    const result = validateGraphQL('{ shop { fake1 fake2 } }', API_VERSION)
    const formatted = formatValidationErrors(result.errors)
    expect(formatted).toContain('1.')
    expect(formatted).toContain('2.')
  })

  it('includes line and column numbers', () => {
    const result = validateGraphQL('{ shop { fake } }', API_VERSION)
    const formatted = formatValidationErrors(result.errors)
    expect(formatted).toMatch(/\(line \d+, col \d+\)/)
  })

  it('handles errors without locations', () => {
    // Create a mock error without location
    const mockErrors = [{ message: 'Test error without location' }] as any
    const formatted = formatValidationErrors(mockErrors)
    expect(formatted).toBe('Test error without location')
    expect(formatted).not.toContain('line')
  })
})
