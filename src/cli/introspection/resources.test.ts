import { describe, it, expect } from 'vitest'

import { getType } from './index'
import { resourceToType } from './resources'

describe('resourceToType', () => {
  it('maps to existing schema types', () => {
    for (const [resource, typeName] of Object.entries(resourceToType)) {
      expect(getType(typeName), `${resource} -> ${typeName}`).toBeTruthy()
    }
  })
})

