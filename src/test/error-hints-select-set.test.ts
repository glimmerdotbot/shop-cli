import { describe, expect, it } from 'vitest'

import { buildInput } from '../cli/input'
import { resolveSelection } from '../cli/selection/select'

describe('helpful error hints', () => {
  it('hints when --select looks like GraphQL', () => {
    expect(() =>
      resolveSelection({
        view: 'summary',
        baseSelection: { id: true } as const,
        select: '{ id title }',
        selection: undefined,
        ensureId: true,
      }),
    ).toThrowError(
      'This looks like GraphQL; use dot paths like variants.nodes.id (repeat --select).',
    )
  })

  it('hints when --set is passed an object instead of path=value', () => {
    expect(() => buildInput({ setArgs: ["{foo:'bar'}"] })).toThrowError(
      'Did you mean --set field=<object>? --set is path=value.',
    )
  })
})

