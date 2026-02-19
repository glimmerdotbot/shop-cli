import { commandRegistry } from './help/registry'
import { formatCommandRef } from './command'

const findResourceSpec = (resource: string) =>
  commandRegistry.find((entry) => entry.resource === resource)

const findVerbSpec = (resource: string, verb: string) => {
  const resourceSpec = findResourceSpec(resource)
  return resourceSpec?.verbs.find((entry) => entry.verb === verb)
}

const isHelpLikeFlag = (token: string) =>
  token === '--help' || token === '-h' || token === '--help-full' || token === '--help-all'

export const parseVerbAndRest = ({
  resource,
  afterResource,
}: {
  resource: string
  afterResource: string[]
}): { verb: string; rest: string[] } => {
  const firstFlagIndex = afterResource.findIndex((t) => t.startsWith('-'))
  const beforeFlags = firstFlagIndex === -1 ? afterResource : afterResource.slice(0, firstFlagIndex)

  // Special handling for some resources that intentionally treat arbitrary non-flag tokens as part
  // of the verb (e.g. `types` uses the verb position for type names; `graphql` can embed queries).
  if (resource === 'types' || resource === 'graphql') {
    const verb = beforeFlags.join(' ')
    const rest = firstFlagIndex === -1 ? [] : afterResource.slice(firstFlagIndex)
    return { verb, rest }
  }

  const resourceSpec = findResourceSpec(resource)
  if (resourceSpec) {
    const knownVerbs = new Set(resourceSpec.verbs.map((v) => v.verb))
    for (let i = beforeFlags.length; i >= 1; i--) {
      const candidate = beforeFlags.slice(0, i).join(' ')
      if (knownVerbs.has(candidate)) {
        return { verb: candidate, rest: afterResource.slice(i) }
      }
    }
  }

  // Fallback to current behavior: treat everything up to the first flag as the verb.
  const verbParts = beforeFlags
  const rest = firstFlagIndex === -1 ? [] : afterResource.slice(firstFlagIndex)
  return { verb: verbParts.join(' '), rest }
}

const looksLikeShopifyId = (value: string) => {
  if (/^\d+$/.test(value)) return true
  if (value.startsWith('gid://')) return true
  return false
}

const requiresIdFlag = (resource: string, verb: string) => {
  const spec = findVerbSpec(resource, verb)
  return Boolean(spec?.requiredFlags?.some((f) => f.label === '--id <gid>' || f.label.startsWith('--id ')))
}

const hasIdFlag = (args: string[]) => args.some((t) => t === '--id' || t.startsWith('--id='))

export const buildMissingIdHint = ({
  command,
  resource,
  verb,
  rest,
}: {
  command: string
  resource: string
  verb: string
  rest: string[]
}): string | undefined => {
  if (!verb) return undefined
  if (!requiresIdFlag(resource, verb)) return undefined
  if (hasIdFlag(rest)) return undefined

  // If the first token after the verb isn't a flag, it's likely a positional ID.
  const first = rest[0]
  if (typeof first !== 'string' || !first || first.startsWith('-')) return undefined
  if (!looksLikeShopifyId(first)) return undefined

  // If they're asking for help, don't override help output with a hint.
  if (rest.some(isHelpLikeFlag)) return undefined

  const tail = rest.slice(1)
  const tailText = tail.length > 0 ? ` ${tail.join(' ')}` : ''
  const suggested = formatCommandRef(
    `  shop ${resource} ${verb} --id ${first}${tailText}`,
    command,
  )
  return [
    'Missing --id <ID>',
    'Did you mean:',
    suggested,
  ].join('\n')
}

export const buildUnexpectedPositionalHint = ({
  command,
  resource,
  verb,
  rest,
}: {
  command: string
  resource: string
  verb: string
  rest: string[]
}): string | undefined => {
  if (!verb) return undefined
  if (resource === 'types' || resource === 'graphql') return undefined
  if (rest.some(isHelpLikeFlag)) return undefined

  // Only hint when this is a known verb and the first token after it is positional.
  const spec = findVerbSpec(resource, verb)
  if (!spec) return undefined
  const first = rest[0]
  if (typeof first !== 'string' || !first || first.startsWith('-')) return undefined

  const seeHelp = formatCommandRef(`shop ${resource} ${verb} --help`, command)
  return [
    `Unexpected argument: \`${first}\`.`,
    `This command only accepts flags. See \`${seeHelp}\`.`,
  ].join('\n')
}
