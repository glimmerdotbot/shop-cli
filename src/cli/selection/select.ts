import { CliError } from '../errors'
import type { CliView } from '../router'

import { parseGraphqlSelectionArg, type GenqlSelection } from './graphqlSelection'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertValidDotPath = (path: string) => {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) throw new CliError(`Invalid --select path: ${path}`, 2)
  for (const part of parts) {
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(part)) {
      throw new CliError(`Invalid --select path segment: ${part}`, 2)
    }
  }
  return parts
}

const deepCloneSelection = (selection: GenqlSelection): GenqlSelection => JSON.parse(JSON.stringify(selection))

const hasAnyFields = (selection: GenqlSelection) =>
  Object.keys(selection).filter((k) => k !== '__args').length > 0

const ensureIdSelected = (selection: GenqlSelection) => {
  if (!('id' in selection)) selection.id = true
  return selection
}

const mergeDotPath = ({
  selection,
  path,
  defaultConnectionFirst,
}: {
  selection: GenqlSelection
  path: string
  defaultConnectionFirst: number
}) => {
  const parts = assertValidDotPath(path)
  let cursor: GenqlSelection = selection

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!
    const isLeaf = i === parts.length - 1
    const nextKey = parts[i + 1]
    const selectingConnectionChildren = nextKey === 'nodes' || nextKey === 'edges'

    if (isLeaf) {
      const existing = cursor[key]
      if (existing === undefined) {
        cursor[key] = true
      } else if (existing === true) {
        // noop
      } else if (isPlainObject(existing)) {
        // keep more specific existing selection
      } else {
        cursor[key] = true
      }
      return
    }

    const existing = cursor[key]
    if (existing === true) {
      throw new CliError(`Invalid --select: cannot select nested fields under '${parts.slice(0, i + 1).join('.')}'`, 2)
    }

    if (!isPlainObject(existing)) {
      cursor[key] = {}
    }

    const obj = cursor[key] as GenqlSelection

    if (selectingConnectionChildren) {
      if (!obj.__args) obj.__args = { first: defaultConnectionFirst }
      if (!obj.pageInfo) obj.pageInfo = { hasNextPage: true, endCursor: true }
    }

    cursor = obj
  }
}

export const resolveSelection = ({
  view,
  baseSelection,
  select,
  selection,
  ensureId,
  defaultConnectionFirst = 10,
}: {
  view: CliView
  baseSelection: GenqlSelection
  select: unknown
  selection: unknown
  ensureId: boolean
  defaultConnectionFirst?: number
}): GenqlSelection => {
  const override = typeof selection === 'string' && selection.length > 0 ? parseGraphqlSelectionArg(selection) : undefined

  const selectPaths = Array.isArray(select) ? select : select === undefined ? [] : [select]
  for (const p of selectPaths) {
    if (typeof p !== 'string') throw new CliError('--select must be a string (repeatable)', 2)
  }

  const mergedBase: GenqlSelection =
    view === 'raw'
      ? {}
      : deepCloneSelection(baseSelection)

  let out = override ? deepCloneSelection(override) : mergedBase

  for (const p of selectPaths as string[]) {
    mergeDotPath({ selection: out, path: p, defaultConnectionFirst })
  }

  if (ensureId) ensureIdSelected(out)

  if (!hasAnyFields(out)) {
    if (view === 'raw') {
      throw new CliError('--view raw requires --select and/or --selection', 2)
    }
    throw new CliError('Selection set is empty', 2)
  }

  return out
}

