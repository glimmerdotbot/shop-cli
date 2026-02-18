import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseJsonArg, requireId } from './_shared'

const menuSummarySelection = {
  id: true,
  title: true,
  handle: true,
  isDefault: true,
} as const

const menuFullSelection = {
  ...menuSummarySelection,
} as const

const getMenuSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return menuFullSelection
  if (view === 'raw') return {} as const
  return menuSummarySelection
}

const requireMenuArgs = (value: any, required: Array<'title' | 'handle' | 'items'>) => {
  if (value === null || typeof value !== 'object') throw new CliError('Menu input must be an object', 2)
  for (const key of required) {
    if (value[key] === undefined) throw new CliError(`Missing ${key} in --input/--set`, 2)
  }
  return value
}

export const runMenus = async ({
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
        '  shop menus <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
        '  create-basic|update-basic',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'create-basic') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { title: { type: 'string' }, handle: { type: 'string' }, items: { type: 'string' } },
    })
    const title = (args as any).title as string | undefined
    const handle = (args as any).handle as string | undefined
    const itemsRaw = (args as any).items as string | undefined

    if (!title) throw new CliError('Missing --title', 2)
    if (!handle) throw new CliError('Missing --handle', 2)
    if (!itemsRaw) throw new CliError('Missing --items', 2)

    const items = parseJsonArg(itemsRaw, '--items')
    if (!Array.isArray(items)) throw new CliError('--items must be a JSON array', 2)

    const result = await runMutation(ctx, {
      menuCreate: {
        __args: { title, handle, items },
        menu: menuSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.menuCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.menuCreate?.menu?.id ?? '')
    printJson(result.menuCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-basic') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { title: { type: 'string' }, handle: { type: 'string' }, items: { type: 'string' } },
    })
    const id = requireId(args.id, 'Menu')
    const title = (args as any).title as string | undefined
    const handle = (args as any).handle as string | undefined
    const itemsRaw = (args as any).items as string | undefined

    if (!title) throw new CliError('Missing --title', 2)
    if (!itemsRaw) throw new CliError('Missing --items', 2)

    const items = parseJsonArg(itemsRaw, '--items')
    if (!Array.isArray(items)) throw new CliError('--items must be a JSON array', 2)

    const result = await runMutation(ctx, {
      menuUpdate: {
        __args: { id, title, ...(handle ? { handle } : {}), items },
        menu: menuSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.menuUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.menuUpdate?.menu?.id ?? '')
    printJson(result.menuUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Menu')
    const selection = resolveSelection({
      resource: 'menus',
      view: ctx.view,
      baseSelection: getMenuSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { menu: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.menu, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'menus',
      view: ctx.view,
      baseSelection: getMenuSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      menus: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.menus,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('menus', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = requireMenuArgs(built.input, ['title', 'handle', 'items'])

    const result = await runMutation(ctx, {
      menuCreate: {
        __args: { title: input.title, handle: input.handle, items: input.items },
        menu: menuSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.menuCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.menuCreate?.menu?.id ?? '')
    printJson(result.menuCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Menu')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = requireMenuArgs(built.input, ['title', 'items'])

    const mutationArgs = {
      id,
      title: input.title,
      items: input.items,
      ...(input.handle === undefined ? {} : { handle: input.handle }),
    }

    const result = await runMutation(ctx, {
      menuUpdate: {
        __args: mutationArgs,
        menu: menuSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.menuUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.menuUpdate?.menu?.id ?? '')
    printJson(result.menuUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Menu')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      menuDelete: {
        __args: { id },
        deletedMenuId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.menuDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.menuDelete?.deletedMenuId ?? '')
    printJson(result.menuDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for menus: ${verb}`, 2)
}
