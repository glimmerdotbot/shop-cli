import fs from 'node:fs'
import path from 'node:path'

import { commandRegistry } from '../src/cli/help/registry'

const routerPath = path.join(__dirname, '..', 'src', 'cli', 'router.ts')
const verbsDir = path.join(__dirname, '..', 'src', 'cli', 'verbs')

const routerText = fs.readFileSync(routerPath, 'utf8')

const importRegex = /import\s+\{([^}]+)\}\s+from\s+'\.\/verbs\/([^']+)'/g
const runToFile = new Map<string, string>()

for (const match of routerText.matchAll(importRegex)) {
  const names = match[1] ?? ''
  const file = match[2]
  for (const raw of names.split(',')) {
    const name = raw.trim()
    if (!name) continue
    runToFile.set(name, `${file}.ts`)
  }
}

const resourceRegex = /if\s*\(resource\s*===\s*'([^']+)'\)\s*return\s+([A-Za-z0-9_]+)\(/g
const resourceToFile = new Map<string, string>()

for (const match of routerText.matchAll(resourceRegex)) {
  const resource = match[1]
  const runner = match[2]
  const file = runToFile.get(runner)
  if (!file) continue
  resourceToFile.set(resource, file)
}

const extractVerbs = (text: string) => {
  const verbs = new Set<string>()
  const ifRegex = /if\s*\(verb[^)]*\)/g
  for (const match of text.matchAll(ifRegex)) {
    const condition = match[0]
    const verbMatches = [...condition.matchAll(/'([^']+)'/g)].map((m) => m[1])
    for (const verb of verbMatches) {
      verbs.add(verb)
    }
  }
  return verbs
}

const registryMap = new Map<string, Set<string>>()
for (const resource of commandRegistry) {
  registryMap.set(resource.resource, new Set(resource.verbs.map((verb) => verb.verb)))
}

const missingResources: string[] = []
const extraResources: string[] = []
const missingVerbs: string[] = []
const extraVerbs: string[] = []

for (const [resource, file] of resourceToFile.entries()) {
  const registryVerbs = registryMap.get(resource)
  if (!registryVerbs) {
    missingResources.push(resource)
    continue
  }

  const verbPath = path.join(verbsDir, file)
  const text = fs.readFileSync(verbPath, 'utf8')
  const verbs = extractVerbs(text)

  if (resource === 'products' && verbs.has('metafields')) {
    verbs.delete('metafields')
    verbs.add('metafields upsert')
  }

  for (const verb of verbs) {
    if (!registryVerbs.has(verb)) {
      missingVerbs.push(`${resource}: ${verb}`)
    }
  }

  for (const verb of registryVerbs) {
    if (!verbs.has(verb)) {
      extraVerbs.push(`${resource}: ${verb}`)
    }
  }
}

for (const resource of registryMap.keys()) {
  if (!resourceToFile.has(resource)) {
    extraResources.push(resource)
  }
}

if (missingResources.length || extraResources.length || missingVerbs.length || extraVerbs.length) {
  const lines: string[] = ['Help coverage check failed:']
  if (missingResources.length) {
    lines.push('', 'Missing resources:', ...missingResources.map((r) => `  ${r}`))
  }
  if (extraResources.length) {
    lines.push('', 'Extra resources (not routed):', ...extraResources.map((r) => `  ${r}`))
  }
  if (missingVerbs.length) {
    lines.push('', 'Missing verbs:', ...missingVerbs.map((v) => `  ${v}`))
  }
  if (extraVerbs.length) {
    lines.push('', 'Extra verbs (not in handler):', ...extraVerbs.map((v) => `  ${v}`))
  }
  console.error(lines.join('\n'))
  process.exit(1)
}

console.log('Help coverage check passed.')
