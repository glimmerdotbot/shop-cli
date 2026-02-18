import { CliError } from '../errors'
import { getFields, getType } from '../introspection'

import type { GenqlSelection } from './graphqlSelection'

const hasAnySelectedFields = (selection: GenqlSelection) =>
  Object.keys(selection).filter((k) => k !== '__args' && k !== '__directives' && k !== '__name').length > 0

const getConnectionNodeTypeName = (connectionTypeName: string): string | undefined => {
  const connectionType = getType(connectionTypeName)
  const nodesTypeName = connectionType?.fields?.nodes?.type?.name
  if (nodesTypeName) return nodesTypeName

  // Fallback: edges.node
  const edgesTypeName = connectionType?.fields?.edges?.type?.name
  if (!edgesTypeName) return undefined
  const edgesType = getType(edgesTypeName)
  return edgesType?.fields?.node?.type?.name
}

/**
 * Validate that all --include targets are valid connection fields without required args.
 * Throws CliError if any are invalid.
 */
export const validateIncludes = (typeName: string, includes: string[]) => {
  const fields = getFields(typeName)
  const fieldMap = new Map(fields.map((f) => [f.name, f]))

  for (const name of includes) {
    const field = fieldMap.get(name)
    if (!field) {
      throw new CliError(`Unknown field: ${name}`, 2)
    }
    if (!field.isConnection) {
      throw new CliError(`Field "${name}" is not a connection field. Use --select for non-connection fields.`, 2)
    }
    if (field.hasRequiredArgs) {
      throw new CliError(`Connection "${name}" has required arguments and cannot be used with --include.`, 2)
    }
  }
}

/**
 * Build a selection that includes all scalar fields and nested object fields.
 * Skips connections and fields with required arguments.
 *
 * Connections are only included if explicitly requested via includeConnections.
 */
export const buildAllSelection = (
  typeName: string,
  includeConnections: string[] = [],
  depth = 0,
  maxDepth = 2,
  visited = new Set<string>(),
  defaultConnectionFirst = 10,
): GenqlSelection => {
  const type = getType(typeName)
  if (!type) throw new CliError(`Unknown GraphQL type: ${typeName}`, 2)

  // Prevent infinite recursion from circular types
  if (visited.has(typeName) || depth > maxDepth) {
    return {}
  }
  visited.add(typeName)

  const fields = getFields(typeName)
  const selection: GenqlSelection = {}

  // Expand all safe scalar fields via genql's __scalar mechanism.
  if (type.scalar && type.scalar.length > 0) {
    ;(selection as any).__scalar = true
  }

  for (const field of fields) {
    if (field.hasRequiredArgs) continue

    if (field.isConnection) {
      if (!includeConnections.includes(field.name)) continue

      const nodeTypeName = getConnectionNodeTypeName(field.typeName)
      if (!nodeTypeName) continue

      const nodesSelection = buildAllSelection(
        nodeTypeName,
        [],
        depth + 1,
        maxDepth,
        new Set(visited),
        defaultConnectionFirst,
      )

      if (!hasAnySelectedFields(nodesSelection)) continue

      selection[field.name] = {
        __args: { first: defaultConnectionFirst },
        ...(getType(field.typeName)?.fields?.nodes
          ? { nodes: nodesSelection }
          : { edges: { node: nodesSelection } }),
        pageInfo: { hasNextPage: true, endCursor: true },
      } as any
      continue
    }

    if (field.isScalar) {
      // Scalars are handled by __scalar above.
      continue
    }

    const nested = buildAllSelection(
      field.typeName,
      [],
      depth + 1,
      maxDepth,
      new Set(visited),
      defaultConnectionFirst,
    )
    if (!hasAnySelectedFields(nested)) continue
    selection[field.name] = nested
  }

  return selection
}

