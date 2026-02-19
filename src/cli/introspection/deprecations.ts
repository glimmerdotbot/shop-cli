import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse, Kind, type DefinitionNode, type DocumentNode } from 'graphql'

type DeprecatedFieldMap = Map<string, Set<string>>

let cachedDeprecatedFieldMap: DeprecatedFieldMap | undefined

const schemaPath = (() => {
  if (typeof __dirname === 'string') {
    return resolve(__dirname, '../../generated/admin-2026-04/schema.graphql')
  }

  const packageRoot = process.env.SHOP_CLI_PACKAGE_ROOT
  if (packageRoot) {
    const distPath = resolve(packageRoot, 'dist', 'generated', 'admin-2026-04', 'schema.graphql')
    if (existsSync(distPath)) return distPath

    const srcPath = resolve(packageRoot, 'src', 'generated', 'admin-2026-04', 'schema.graphql')
    if (existsSync(srcPath)) return srcPath
  }

  throw new Error('Unable to locate schema.graphql; set SHOP_CLI_PACKAGE_ROOT or run the compiled CLI')
})()

const hasDeprecatedDirective = (directives: any[] | undefined): boolean =>
  Array.isArray(directives) && directives.some((d) => d?.name?.value === 'deprecated')

const addDeprecatedFields = (
  map: DeprecatedFieldMap,
  typeName: string,
  fields: Array<{ name: { value: string }; directives?: any[] }> | undefined,
) => {
  if (!fields || fields.length === 0) return
  for (const f of fields) {
    const fieldName = f?.name?.value
    if (!fieldName) continue
    if (!hasDeprecatedDirective(f.directives)) continue
    const set = map.get(typeName) ?? new Set<string>()
    set.add(fieldName)
    map.set(typeName, set)
  }
}

const buildDeprecatedFieldMap = (doc: DocumentNode): DeprecatedFieldMap => {
  const map: DeprecatedFieldMap = new Map()

  for (const def of doc.definitions as DefinitionNode[]) {
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION) {
      addDeprecatedFields(map, def.name.value, def.fields as any)
      continue
    }
    if (def.kind === Kind.INTERFACE_TYPE_DEFINITION || def.kind === Kind.INTERFACE_TYPE_EXTENSION) {
      addDeprecatedFields(map, def.name.value, def.fields as any)
      continue
    }
    if (def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION || def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION) {
      addDeprecatedFields(map, def.name.value, def.fields as any)
      continue
    }
  }

  return map
}

const getDeprecatedFieldMap = (): DeprecatedFieldMap => {
  if (!cachedDeprecatedFieldMap) {
    const sdl = readFileSync(schemaPath, 'utf8')
    cachedDeprecatedFieldMap = buildDeprecatedFieldMap(parse(sdl))
  }
  return cachedDeprecatedFieldMap
}

export const isDeprecatedField = (typeName: string, fieldName: string): boolean =>
  getDeprecatedFieldMap().get(typeName)?.has(fieldName) ?? false
