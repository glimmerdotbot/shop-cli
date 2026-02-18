import type { Client } from '../../generated/admin-2026-04'
import { runCommand } from '../../cli/router'

export type DryRunPrinted = {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

const isDryRunPrinted = (value: unknown): value is DryRunPrinted => {
  if (!value || typeof value !== 'object') return false
  return typeof (value as any).query === 'string'
}

const extractJsonObjects = (text: string): unknown[] => {
  const out: unknown[] = []

  let i = 0
  while (i < text.length) {
    while (i < text.length && text[i] !== '{') i++
    if (i >= text.length) break

    const start = i
    let depth = 0
    let inString = false
    let escape = false

    for (; i < text.length; i++) {
      const ch = text[i]!

      if (inString) {
        if (escape) {
          escape = false
          continue
        }
        if (ch === '\\') {
          escape = true
          continue
        }
        if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === '{') depth++
      if (ch === '}') depth--

      if (depth === 0) {
        const candidate = text.slice(start, i + 1)
        try {
          out.push(JSON.parse(candidate))
        } catch {
          // ignore
        }
        i++
        break
      }
    }
  }

  return out
}

const createDryRunClient = (): Client =>
  ({
    query: async () => {
      throw new Error('Unexpected client.query call in --dry-run')
    },
    mutation: async () => {
      throw new Error('Unexpected client.mutation call in --dry-run')
    },
  }) as any

export async function runCommandDryRun({
  resource,
  verb,
  argv,
  view = 'summary',
}: {
  resource: string
  verb: string
  argv: string[]
  view?: 'summary' | 'ids' | 'full' | 'raw' | 'all'
}): Promise<DryRunPrinted[]> {
  const { printed, error } = await tryRunCommandDryRun({ resource, verb, argv, view })
  if (error) throw error
  return printed
}

export async function tryRunCommandDryRun({
  resource,
  verb,
  argv,
  view = 'summary',
}: {
  resource: string
  verb: string
  argv: string[]
  view?: 'summary' | 'ids' | 'full' | 'raw' | 'all'
}): Promise<{ printed: DryRunPrinted[]; error?: unknown }> {
  let rawOutput = ''

  const originalLog = console.log
  const originalWrite = process.stdout.write.bind(process.stdout)

  console.log = (...args: unknown[]) => {
    rawOutput += args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    rawOutput += '\n'
  }

  // Capture any output that bypasses console.log (e.g. printJson uses process.stdout.write).
  ;(process.stdout.write as any) = (chunk: any, encoding?: any, cb?: any) => {
    rawOutput += typeof chunk === 'string' ? chunk : chunk?.toString?.(encoding) ?? String(chunk)
    if (typeof cb === 'function') cb()
    return true
  }

  try {
    await runCommand({
      client: createDryRunClient(),
      resource,
      verb,
      argv,
      format: 'json',
      quiet: false,
      view,
      dryRun: true,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
      shopDomain: 'example.myshopify.com',
      graphqlEndpoint: undefined,
      accessToken: 'DUMMY',
      apiVersion: '2026-04',
      headers: {},
    })
    const printed = extractJsonObjects(rawOutput).filter(isDryRunPrinted)
    return { printed }
  } catch (error) {
    const printed = extractJsonObjects(rawOutput).filter(isDryRunPrinted)
    return { printed, error }
  } finally {
    console.log = originalLog
    ;(process.stdout.write as any) = originalWrite
  }
}
