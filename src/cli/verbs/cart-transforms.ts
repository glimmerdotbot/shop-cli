import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseJsonArg, requireId } from './_shared'

const cartTransformSelection = {
  id: true,
  functionId: true,
  blockOnFailure: true,
  metafields: {
    __args: { first: 5 },
    nodes: { namespace: true, key: true, value: true },
  },
} as const

export const runCartTransforms = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop cart-transforms <verb> [flags]',
        '',
        'Verbs:',
        '  create|list|delete',
      ].join('\n'),
    )
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      cartTransforms: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: cartTransformSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.cartTransforms,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('cart-transforms', { first, reverse }),
    })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'function-id': { type: 'string' },
        'function-handle': { type: 'string' },
        'block-on-failure': { type: 'boolean' },
        metafields: { type: 'string' },
      },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const functionId = (args['function-id'] as string | undefined) ?? input.functionId
    const functionHandle = (args['function-handle'] as string | undefined) ?? input.functionHandle
    const blockOnFailure =
      args['block-on-failure'] !== undefined ? Boolean(args['block-on-failure']) : input.blockOnFailure
    const metafields = args.metafields ? parseJsonArg(args.metafields, '--metafields') : input.metafields

    if (!functionId && !functionHandle) {
      throw new CliError('Missing --function-id or --function-handle', 2)
    }

    const result = await runMutation(ctx, {
      cartTransformCreate: {
        __args: {
          ...(functionId ? { functionId } : {}),
          ...(functionHandle ? { functionHandle } : {}),
          ...(blockOnFailure === undefined ? {} : { blockOnFailure }),
          ...(metafields ? { metafields } : {}),
        },
        cartTransform: cartTransformSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.cartTransformCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.cartTransformCreate?.cartTransform?.id ?? '')
    printJson(result.cartTransformCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CartTransform')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      cartTransformDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.cartTransformDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.cartTransformDelete?.deletedId ?? '')
    printJson(result.cartTransformDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for cart-transforms: ${verb}`, 2)
}
