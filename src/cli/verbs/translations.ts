import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseJsonArg, parseStringList } from './_shared'

const buildTranslatableResourceSelection = (locale: string) =>
  ({
    resourceId: true,
    translations: {
      __args: { locale },
      locale: true,
      key: true,
      value: true,
      market: { id: true },
    },
    translatableContent: { key: true, value: true, digest: true, locale: true },
  }) as const

const getTranslatableSelection = (view: CommandContext['view']) => {
  if (view === 'raw') return {} as const
  return buildTranslatableResourceSelection('en')
}

export const runTranslations = async ({
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
        '  shop translations <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|list-by-ids|register|remove',
        '',
        'Common output flags:',
        '  --view summary|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: { 'resource-id': { type: 'string' }, locale: { type: 'string' } } })
    const resourceId = args['resource-id'] as string | undefined
    if (!resourceId) throw new CliError('Missing --resource-id', 2)
    const locale = args.locale as string | undefined
    if (!locale) throw new CliError('Missing --locale', 2)

    const selection = resolveSelection({
      resource: 'translations',
      typeName: 'TranslatableResource',
      view: ctx.view,
      baseSelection: buildTranslatableResourceSelection(locale) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: false,
    })

    const result = await runQuery(ctx, { translatableResource: { __args: { resourceId }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.translatableResource, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: { 'resource-type': { type: 'string' }, locale: { type: 'string' } } })
    const resourceType = args['resource-type'] as string | undefined
    if (!resourceType) throw new CliError('Missing --resource-type', 2)
    const locale = args.locale as string | undefined
    if (!locale) throw new CliError('Missing --locale', 2)

    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const selection = resolveSelection({
      resource: 'translations',
      typeName: 'TranslatableResource',
      view: ctx.view,
      baseSelection: buildTranslatableResourceSelection(locale) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: false,
    })

    const result = await runQuery(ctx, {
      translatableResources: {
        __args: { first, after, reverse, resourceType },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: selection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.translatableResources, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list-by-ids') {
    const args = parseStandardArgs({ argv, extraOptions: { 'resource-ids': { type: 'string', multiple: true }, locale: { type: 'string' } } })
    const resourceIds = parseStringList(args['resource-ids'], '--resource-ids')
    const locale = args.locale as string | undefined
    if (!locale) throw new CliError('Missing --locale', 2)

    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const selection = resolveSelection({
      resource: 'translations',
      typeName: 'TranslatableResource',
      view: ctx.view,
      baseSelection: buildTranslatableResourceSelection(locale) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: false,
    })

    const result = await runQuery(ctx, {
      translatableResourcesByIds: {
        __args: { first, after, reverse, resourceIds },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: selection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.translatableResourcesByIds, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'register') {
    const args = parseStandardArgs({ argv, extraOptions: { 'resource-id': { type: 'string' }, translations: { type: 'string' } } })
    const resourceId = args['resource-id'] as string | undefined
    if (!resourceId) throw new CliError('Missing --resource-id', 2)
    const translations = parseJsonArg(args.translations, '--translations')

    const result = await runMutation(ctx, {
      translationsRegister: {
        __args: { resourceId, translations },
        translations: { key: true, locale: true, value: true, market: { id: true } },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.translationsRegister, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.translationsRegister, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'resource-id': { type: 'string' },
        'translation-keys': { type: 'string', multiple: true },
        locales: { type: 'string', multiple: true },
        'market-ids': { type: 'string', multiple: true },
      },
    })
    const resourceId = args['resource-id'] as string | undefined
    if (!resourceId) throw new CliError('Missing --resource-id', 2)
    const translationKeys = parseStringList(args['translation-keys'], '--translation-keys')
    const locales = parseStringList(args.locales, '--locales')
    const marketIds = args['market-ids'] ? parseStringList(args['market-ids'], '--market-ids') : undefined

    const result = await runMutation(ctx, {
      translationsRemove: {
        __args: { resourceId, translationKeys, locales, ...(marketIds ? { marketIds } : {}) },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.translationsRemove, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.translationsRemove, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for translations: ${verb}`, 2)
}
