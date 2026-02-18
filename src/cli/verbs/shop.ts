import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseStringList } from './_shared'

const shopSummarySelection = {
  id: true,
  name: true,
  email: true,
  myshopifyDomain: true,
  primaryDomain: { url: true },
  currencyCode: true,
  timezoneAbbreviation: true,
} as const

const getShopSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return shopSummarySelection
}

export const runShopConfig = async ({
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
        '  shop config <verb> [flags]',
        '',
        'Verbs:',
        '  get|update-policy|enable-locale|disable-locale|update-locale|get-locales',
        '',
        'Common output flags:',
        '  --view summary|ids|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      resource: 'config',
      view: ctx.view,
      baseSelection: getShopSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { shop: selection })
    if (result === undefined) return
    printNode({ node: result.shop, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'update-policy') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      shopPolicyUpdate: {
        __args: { shopPolicy: built.input },
        shopPolicy: { id: true, title: true, body: true, url: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shopPolicyUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.shopPolicyUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'enable-locale') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { locale: { type: 'string' }, 'market-web-presence-ids': { type: 'string', multiple: true } },
    })
    const locale = args.locale as string | undefined
    if (!locale) throw new CliError('Missing --locale', 2)
    const marketWebPresenceIds = args['market-web-presence-ids']
      ? parseStringList(args['market-web-presence-ids'], '--market-web-presence-ids')
      : undefined

    const result = await runMutation(ctx, {
      shopLocaleEnable: {
        __args: { locale, ...(marketWebPresenceIds ? { marketWebPresenceIds } : {}) },
        shopLocale: { locale: true, primary: true, published: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shopLocaleEnable, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.shopLocaleEnable, ctx.format !== 'raw')
    return
  }

  if (verb === 'disable-locale') {
    const args = parseStandardArgs({ argv, extraOptions: { locale: { type: 'string' } } })
    const locale = args.locale as string | undefined
    if (!locale) throw new CliError('Missing --locale', 2)

    const result = await runMutation(ctx, {
      shopLocaleDisable: {
        __args: { locale },
        locale: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shopLocaleDisable, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.shopLocaleDisable, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-locale') {
    const args = parseStandardArgs({ argv, extraOptions: { locale: { type: 'string' } } })
    const locale = args.locale as string | undefined
    if (!locale) throw new CliError('Missing --locale', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      shopLocaleUpdate: {
        __args: { locale, shopLocale: built.input },
        shopLocale: { locale: true, primary: true, published: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.shopLocaleUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.shopLocaleUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get-locales') {
    const args = parseStandardArgs({ argv, extraOptions: { published: { type: 'boolean' } } })
    const published = args.published as boolean | undefined

    const result = await runQuery(ctx, {
      shopLocales: { __args: { ...(published === undefined ? {} : { published }) }, locale: true, primary: true, published: true },
    })
    if (result === undefined) return
    printJson(result.shopLocales, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for config: ${verb}`, 2)
}
