import types from '../../generated/admin-2026-04/types'
import { linkTypeMap } from '../../generated/admin-2026-04/runtime'
import type { LinkedField, LinkedType, LinkedTypeMap } from '../../generated/admin-2026-04/runtime/types'

export type { LinkedType, LinkedTypeMap } from '../../generated/admin-2026-04/runtime/types'

let cachedTypeMap: LinkedTypeMap | undefined

export const getTypeMap = (): LinkedTypeMap => {
  if (!cachedTypeMap) {
    cachedTypeMap = linkTypeMap(types as any)
  }
  return cachedTypeMap
}

export const getType = (name: string): LinkedType | undefined => getTypeMap()[name]

export type FieldInfo = {
  name: string
  typeName: string
  isScalar: boolean
  isConnection: boolean
  connectionNodeTypeName?: string
  hasRequiredArgs: boolean
}

const hasRequiredArgs = (field: LinkedField): boolean => {
  const args = field.args ?? {}
  return Object.values(args).some((arg) => arg?.[1]?.endsWith('!'))
}

const getConnectionNodeTypeName = (connectionType: LinkedType): string | undefined => {
  const nodes = connectionType.fields?.nodes?.type
  if (nodes?.name) return nodes.name

  const edges = connectionType.fields?.edges?.type
  const edgeNode = edges?.fields?.node?.type
  if (edgeNode?.name) return edgeNode.name

  return undefined
}

export const getFields = (typeName: string): FieldInfo[] => {
  const type = getType(typeName)
  if (!type?.fields) return []

  const scalarFields = new Set(type.scalar ?? [])

  const out: FieldInfo[] = []
  for (const [name, field] of Object.entries(type.fields)) {
    if (!field) continue

    const targetTypeName = field.type?.name ?? 'Unknown'
    const isConnection = targetTypeName.endsWith('Connection')
    const requiredArgs = hasRequiredArgs(field)

    out.push({
      name,
      typeName: targetTypeName,
      isScalar: scalarFields.has(name),
      isConnection,
      connectionNodeTypeName: isConnection ? getConnectionNodeTypeName(field.type) : undefined,
      hasRequiredArgs: requiredArgs,
    })
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

export { resourceToType } from './resources'
