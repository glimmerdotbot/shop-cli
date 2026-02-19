import { CliError } from '../../errors'
import { runQuery, type CommandContext } from '../../router'

type FileTerminalStatus = 'READY' | 'FAILED'

export type WaitForFilesResult = {
  nodes: any[]
  readyIds: string[]
  failedIds: string[]
}

export const pollFilesReadyOrFailed = async ({
  ids,
  pollIntervalMs,
  timeoutMs,
  fetchNodes,
  now = () => Date.now(),
  sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  ids: string[]
  pollIntervalMs: number
  timeoutMs: number
  fetchNodes: (ids: string[]) => Promise<any[]>
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}): Promise<WaitForFilesResult> => {
  const start = now()
  const remaining = new Set(ids)

  let lastNodes: any[] = []

  while (true) {
    lastNodes = await fetchNodes(ids)

    const readyIds: string[] = []
    const failedIds: string[] = []

    for (const node of lastNodes) {
      if (!node || typeof node !== 'object') continue
      const id = typeof (node as any).id === 'string' ? (node as any).id : undefined
      if (!id) continue
      const status = (node as any).fileStatus as string | undefined
      if (status === 'READY') {
        remaining.delete(id)
        readyIds.push(id)
      } else if (status === 'FAILED') {
        remaining.delete(id)
        failedIds.push(id)
      }
    }

    if (remaining.size === 0) {
      return { nodes: lastNodes, readyIds, failedIds }
    }

    const elapsed = now() - start
    if (elapsed >= timeoutMs) {
      const pending = Array.from(remaining)
      throw new CliError(
        `Timed out after ${timeoutMs}ms waiting for files to be READY/FAILED: ${pending.join(', ')}`,
        2,
      )
    }

    await sleep(pollIntervalMs)
  }
}

export const waitForFilesReadyOrFailed = async ({
  ctx,
  ids,
  pollIntervalMs,
  timeoutMs,
}: {
  ctx: CommandContext
  ids: string[]
  pollIntervalMs: number
  timeoutMs: number
}): Promise<WaitForFilesResult> => {
  if (ids.length === 0) return { nodes: [], readyIds: [], failedIds: [] }

  const nodeSelection = {
    __typename: true,
    on_File: {
      id: true,
      fileStatus: true,
      fileErrors: { code: true, message: true, details: true },
      preview: { status: true, image: { url: true } },
    },
    on_GenericFile: { url: true },
  } as const

  return pollFilesReadyOrFailed({
    ids,
    pollIntervalMs,
    timeoutMs,
    fetchNodes: async (fileIds) => {
      const result = await runQuery(ctx, {
        nodes: {
          __args: { ids: fileIds as any },
          ...nodeSelection,
        },
      })
      if (result === undefined) return []
      const nodes = (result.nodes ?? []) as any[]
      return Array.isArray(nodes) ? nodes : []
    },
  })
}

