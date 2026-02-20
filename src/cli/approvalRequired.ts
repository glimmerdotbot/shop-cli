import type { OutputFormat } from './output'
import { printJsonError } from './output'
import { CliError } from './errors'

type ApprovalRequiredAction = Record<string, unknown> & {
  type?: unknown
  status?: unknown
  id?: unknown
  executed?: unknown
  contentType?: unknown
  body?: unknown
}

export type ApprovalRequiredInfo = {
  code: 'APPROVAL_REQUIRED' | 'ACTION_REQUIRED'
  action: ApprovalRequiredAction
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Generic GraphQL proxy contract for deferred execution.
 *
 * When a proxy requires human approval before executing an operation, it may return a
 * standard GraphQL response with an `errors[]` entry that includes:
 * - `error.extensions.code === "APPROVAL_REQUIRED"` (also accepts "ACTION_REQUIRED")
 * - `error.extensions.action` describing the approval workflow
 *
 * In this case, the operation has NOT executed yet. shop-cli surfaces a purpose-built
 * error payload and exits with code 3.
 */
export const findApprovalRequired = (errors: unknown[] | undefined | null): ApprovalRequiredInfo | undefined => {
  if (!Array.isArray(errors)) return undefined

  for (const err of errors) {
    if (!isPlainObject(err)) continue
    const extensions = (err as any).extensions
    if (!isPlainObject(extensions)) continue

    const code = extensions.code
    if (code !== 'APPROVAL_REQUIRED' && code !== 'ACTION_REQUIRED') continue

    const action = extensions.action
    if (!isPlainObject(action)) continue

    // Be strict to avoid false positives.
    if (action.type !== 'approval') continue
    if (action.status !== 'pending') continue
    if (action.executed !== false) continue
    if (typeof action.id !== 'string' || !action.id.trim()) continue
    if (typeof action.body !== 'string' || !action.body.trim()) continue

    return { code, action: action as ApprovalRequiredAction }
  }

  return undefined
}

const writeHumanApprovalMessage = ({ action }: ApprovalRequiredInfo) => {
  const id = String(action.id)
  const body = typeof action.body === 'string' ? action.body.trim() : ''

  const lines: string[] = [
    'Approval required: this operation was NOT executed yet.',
    `Approval id: ${id}`,
    'Execution will happen after approval is granted (out-of-band).',
  ]

  if (body) {
    lines.push('', body)
  }

  process.stderr.write(lines.join('\n').trimEnd() + '\n')
}

export const maybeThrowApprovalRequired = ({
  format,
  errors,
}: {
  format: OutputFormat
  errors: unknown[] | undefined | null
}): void => {
  const approval = findApprovalRequired(errors)
  if (!approval) return

  if (format === 'json' || format === 'jsonl') {
    printJsonError(
      {
        ok: false,
        error: {
          code: approval.code,
          action: approval.action,
        },
      },
      format === 'json',
    )
  } else {
    writeHumanApprovalMessage(approval)
  }

  throw new CliError('', 3, { silent: true })
}

