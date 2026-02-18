import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { requireId } from './_shared'

export const runShippingPackages = async ({
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
        '  shop shipping-packages <verb> [flags]',
        '',
        'Verbs:',
        '  update|make-default|delete',
      ].join('\n'),
    )
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ShippingPackage')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      shippingPackageUpdate: {
        __args: { id, shippingPackage: built.input },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shippingPackageUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.shippingPackageUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'make-default') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ShippingPackage')

    const result = await runMutation(ctx, {
      shippingPackageMakeDefault: {
        __args: { id },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.shippingPackageMakeDefault,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.shippingPackageMakeDefault, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ShippingPackage')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      shippingPackageDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shippingPackageDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.shippingPackageDelete?.deletedId ?? '')
    printJson(result.shippingPackageDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for shipping-packages: ${verb}`, 2)
}

