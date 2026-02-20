import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GenqlError } from '../generated/admin-2026-04'
import { runMutation, type CommandContext } from '../cli/router'
import { CliError } from '../cli/errors'
import { runGraphQL } from '../cli/verbs/graphql'
import * as adminClient from '../adminClient'

const approvalError = {
  message: 'Approval required',
  extensions: {
    code: 'APPROVAL_REQUIRED',
    action: {
      type: 'approval',
      status: 'pending',
      id: 'appr_123',
      executed: false,
      contentType: 'text/markdown',
      body: 'Please approve this action before it can run.',
    },
  },
}

describe('approval-required GraphQL proxy contract', () => {
  const originalErrWrite = process.stderr.write.bind(process.stderr)
  let stderr = ''

  beforeEach(() => {
    stderr = ''
    ;(process.stderr as any).write = (chunk: unknown) => {
      stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    ;(process.stderr as any).write = originalErrWrite
    vi.restoreAllMocks()
  })

  it('GenQL path: emits JSON error + exit code 3 for --format json', async () => {
    const client = {
      mutation: async (_req: any) => {
        throw new GenqlError([approvalError as any], { ok: false } as any)
      },
    }

    const ctx: CommandContext = {
      client: client as any,
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await expect(runMutation(ctx, { shop: { name: true } })).rejects.toMatchObject({
      exitCode: 3,
    })

    const parsed = JSON.parse(stderr.trim())
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe('APPROVAL_REQUIRED')
    expect(parsed.error.action.id).toBe('appr_123')
    expect(stderr).not.toContain('"errors"')
  })

  it('GenQL path: emits human message + exit code 3 for non-JSON formats', async () => {
    const client = {
      mutation: async (_req: any) => {
        throw new GenqlError([approvalError as any], { ok: false } as any)
      },
    }

    const ctx: CommandContext = {
      client: client as any,
      format: 'table',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await expect(runMutation(ctx, { shop: { name: true } })).rejects.toMatchObject({
      exitCode: 3,
    })

    expect(stderr).toContain('Approval required')
    expect(stderr).toContain('NOT executed yet')
    expect(stderr).toContain('Approval id: appr_123')
    expect(stderr).toContain('out-of-band')
    expect(stderr).toContain('Please approve this action before it can run.')
  })

  it('Raw GraphQL path: emits JSON error + exit code 3 for --format json', async () => {
    vi.spyOn(adminClient, 'createRawGraphQLClient').mockReturnValue({
      request: async () => ({ errors: [approvalError as any], data: null } as any),
    } as any)

    const ctx: any = {
      client: {} as any,
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
      shopDomain: 'example.myshopify.com',
      graphqlEndpoint: 'https://example.invalid/graphql',
      accessToken: 'DUMMY',
      apiVersion: undefined,
      headers: {},
    }

    const errObj = await runGraphQL({ ctx, verb: 'query', argv: ['{ shop { name } }', '--no-validate'] }).catch(
      (e) => e,
    )
    expect(errObj).toBeInstanceOf(CliError)
    expect((errObj as CliError).exitCode).toBe(3)

    const parsed = JSON.parse(stderr.trim())
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe('APPROVAL_REQUIRED')
    expect(parsed.error.action.id).toBe('appr_123')
    expect(stderr).not.toContain('"errors"')
  })

  it('Raw GraphQL path: emits human message + exit code 3 for non-JSON formats', async () => {
    vi.spyOn(adminClient, 'createRawGraphQLClient').mockReturnValue({
      request: async () => ({ errors: [approvalError as any], data: null } as any),
    } as any)

    const ctx: any = {
      client: {} as any,
      format: 'table',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
      shopDomain: 'example.myshopify.com',
      graphqlEndpoint: 'https://example.invalid/graphql',
      accessToken: 'DUMMY',
      apiVersion: undefined,
      headers: {},
    }

    const errObj = await runGraphQL({ ctx, verb: 'query', argv: ['{ shop { name } }', '--no-validate'] }).catch(
      (e) => e,
    )
    expect((errObj as CliError).exitCode).toBe(3)

    expect(stderr).toContain('Approval required')
    expect(stderr).toContain('Approval id: appr_123')
    expect(stderr).toContain('NOT executed yet')
    expect(stderr).toContain('out-of-band')
    expect(stderr).toContain('Please approve this action before it can run.')
  })
})
