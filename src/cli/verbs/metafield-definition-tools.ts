import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const metafieldDefinitionSummarySelection = {
  id: true,
  name: true,
  namespace: true,
  key: true,
  ownerType: true,
  type: { name: true, category: true },
} as const

const getMetafieldDefinitionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return metafieldDefinitionSummarySelection
}

const metafieldDefinitionTypeSelection = {
  name: true,
  category: true,
  valueType: true,
  supportedValidations: { name: true, type: true },
  supportsDefinitionMigrations: true,
} as const

const standardTemplateSummarySelection = {
  id: true,
  name: true,
  namespace: true,
  key: true,
  type: { name: true, category: true },
  ownerTypes: true,
  visibleToStorefrontApi: true,
} as const

const getStandardTemplateSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return standardTemplateSummarySelection
}

const buildMetafieldDefinitionIdentifier = ({
  ownerType,
  key,
  namespace,
}: {
  ownerType?: unknown
  key?: unknown
  namespace?: unknown
}) => {
  const ot = typeof ownerType === 'string' ? ownerType : undefined
  const k = typeof key === 'string' ? key : undefined
  const ns = typeof namespace === 'string' ? namespace : undefined

  if (!ot) throw new CliError('Missing --owner-type', 2)
  if (!k) throw new CliError('Missing --key', 2)

  return { ownerType: ot as any, key: k, ...(ns ? { namespace: ns } : {}) }
}

export const runMetafieldDefinitionTools = async ({
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
        '  shop metafield-definition-tools <verb> [flags]',
        '',
        'Verbs:',
        '  types|pin|unpin|update',
        '  standard-templates|standard-enable',
        '',
        'Common output flags:',
        '  --format json|jsonl|table|markdown|raw',
        '  --quiet               (IDs only when possible)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'types') {
    const result = await runQuery(ctx, { metafieldDefinitionTypes: metafieldDefinitionTypeSelection as any })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.metafieldDefinitionTypes, ctx.format !== 'raw')
    return
  }

  if (verb === 'pin' || verb === 'unpin') {
    const args = parseStandardArgs({ argv, extraOptions: { 'definition-id': { type: 'string' } } })
    const definitionIdRaw = (args as any)['definition-id'] ?? args.id

    const identifier = definitionIdRaw
      ? undefined
      : buildMetafieldDefinitionIdentifier({
          ownerType: (args as any)['owner-type'],
          key: (args as any).key,
          namespace: (args as any).namespace,
        })

    const definitionId = definitionIdRaw ? requireId(definitionIdRaw, 'MetafieldDefinition') : undefined

    const mutation = verb === 'pin' ? 'metafieldDefinitionPin' : 'metafieldDefinitionUnpin'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { ...(definitionId ? { definitionId } : {}), ...(identifier ? { identifier } : {}) },
        ...(verb === 'pin'
          ? { pinnedDefinition: metafieldDefinitionSummarySelection }
          : { unpinnedDefinition: metafieldDefinitionSummarySelection }),
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return

    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })

    if (ctx.quiet) {
      const node = payload?.pinnedDefinition ?? payload?.unpinnedDefinition
      return console.log(node?.id ?? '')
    }
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        key: { type: 'string' },
        namespace: { type: 'string' },
        'owner-type': { type: 'string' },
      },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const identifier = buildMetafieldDefinitionIdentifier({
      ownerType: (args as any)['owner-type'] ?? built.input?.ownerType,
      key: (args as any).key ?? built.input?.key,
      namespace: (args as any).namespace ?? built.input?.namespace,
    })

    const definition = {
      ...built.input,
      ownerType: identifier.ownerType,
      key: identifier.key,
      ...(identifier.namespace ? { namespace: identifier.namespace } : {}),
    }

    const result = await runMutation(ctx, {
      metafieldDefinitionUpdate: {
        __args: { definition },
        updatedDefinition: metafieldDefinitionSummarySelection,
        userErrors: { field: true, message: true, code: true },
        validationJob: { id: true, done: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metafieldDefinitionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metafieldDefinitionUpdate?.updatedDefinition?.id ?? '')
    printJson(result.metafieldDefinitionUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'standard-templates') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'constraint-subtype': { type: 'string' },
        'constraint-status': { type: 'string' },
        'exclude-activated': { type: 'boolean' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const constraintSubtype = (args as any)['constraint-subtype'] as any
    const constraintStatus = (args as any)['constraint-status'] as any
    const excludeActivated = (args as any)['exclude-activated'] as boolean | undefined

    const nodeSelection = resolveSelection({
      typeName: 'StandardMetafieldDefinitionTemplate',
      view: ctx.view,
      baseSelection: getStandardTemplateSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      standardMetafieldDefinitionTemplates: {
        __args: {
          ...(constraintSubtype ? { constraintSubtype } : {}),
          ...(constraintStatus ? { constraintStatus } : {}),
          ...(excludeActivated === undefined ? {} : { excludeActivated }),
          first,
          after,
          reverse,
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.standardMetafieldDefinitionTemplates,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop metafield-definition-tools standard-templates',
        first,
        reverse: reverse === true,
        extraFlags: [
          ...(constraintSubtype ? [{ flag: '--constraint-subtype', value: constraintSubtype }] : []),
          ...(constraintStatus ? [{ flag: '--constraint-status', value: constraintStatus }] : []),
          ...(excludeActivated === true ? [{ flag: '--exclude-activated', value: true }] : []),
        ],
      },
    })
    return
  }

  if (verb === 'standard-enable') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        id: { type: 'string' },
        namespace: { type: 'string' },
        key: { type: 'string' },
        'owner-type': { type: 'string' },
        pin: { type: 'boolean' },
        'visible-to-storefront-api': { type: 'boolean' },
        'use-as-collection-condition': { type: 'boolean' },
      },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const ownerType = (args as any)['owner-type'] ?? input.ownerType
    if (!ownerType) throw new CliError('Missing --owner-type', 2)

    const id = (args as any).id ?? input.id
    const namespace = (args as any).namespace ?? input.namespace
    const key = (args as any).key ?? input.key

    const pin = (args as any).pin ?? input.pin
    const visibleToStorefrontApi = (args as any)['visible-to-storefront-api'] ?? input.visibleToStorefrontApi
    const useAsCollectionCondition = (args as any)['use-as-collection-condition'] ?? input.useAsCollectionCondition
    const capabilities = input.capabilities
    const access = input.access

    const result = await runMutation(ctx, {
      standardMetafieldDefinitionEnable: {
        __args: {
          ownerType,
          ...(id ? { id } : {}),
          ...(namespace ? { namespace } : {}),
          ...(key ? { key } : {}),
          ...(pin === undefined ? {} : { pin }),
          ...(visibleToStorefrontApi === undefined ? {} : { visibleToStorefrontApi }),
          ...(useAsCollectionCondition === undefined ? {} : { useAsCollectionCondition }),
          ...(capabilities ? { capabilities } : {}),
          ...(access ? { access } : {}),
        },
        createdDefinition: metafieldDefinitionSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.standardMetafieldDefinitionEnable,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.standardMetafieldDefinitionEnable?.createdDefinition?.id ?? '')
    printJson(result.standardMetafieldDefinitionEnable, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for metafield-definition-tools: ${verb}`, 2)
}
