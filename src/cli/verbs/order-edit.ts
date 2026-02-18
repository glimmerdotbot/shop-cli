import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { requireId } from './_shared'

const moneyV2Selection = { amount: true, currencyCode: true } as const
const moneyBagSelection = { shopMoney: moneyV2Selection, presentmentMoney: moneyV2Selection } as const

const calculatedOrderSummarySelection = {
  id: true,
  originalOrder: { id: true, name: true, subtotalPriceSet: moneyBagSelection },
  subtotalPriceSet: moneyBagSelection,
  totalPriceSet: moneyBagSelection,
  totalOutstandingSet: moneyBagSelection,
  addedLineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      calculatedDiscountAllocations: {
        allocatedAmountSet: moneyBagSelection,
      },
    },
  },
  stagedChanges: {
    __args: { first: 20 },
    nodes: {
      __typename: true,
      on_OrderStagedChangeAddVariant: {
        quantity: true,
        variant: { id: true, title: true },
      },
      on_OrderStagedChangeAddCustomItem: {
        title: true,
        quantity: true,
        originalUnitPrice: moneyV2Selection,
      },
      on_OrderStagedChangeIncrementItem: {
        delta: true,
        lineItem: { id: true, title: true },
      },
      on_OrderStagedChangeDecrementItem: {
        delta: true,
        lineItem: { id: true, title: true },
        restock: true,
      },
    },
  },
} as const

const calculatedOrderFullSelection = {
  ...calculatedOrderSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      stagedChanges: true,
      originalUnitPriceSet: moneyBagSelection,
      calculatedDiscountAllocations: {
        allocatedAmountSet: moneyBagSelection,
        discountApplication: { title: true },
      },
    },
  },
  cartDiscountAmountSet: moneyBagSelection,
  taxLines: { title: true, rate: true, priceSet: moneyBagSelection },
  shippingLines: { title: true, originalPriceSet: moneyBagSelection },
} as const

const orderSummarySelection = {
  id: true,
  name: true,
  updatedAt: true,
  totalPriceSet: moneyBagSelection,
} as const

const getCalculatedOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return calculatedOrderFullSelection
  if (view === 'raw') return {} as const
  return calculatedOrderSummarySelection
}

const requireOrderId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --order-id', 2)
  return coerceGid(value, 'Order')
}

const requireVariantId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --variant-id', 2)
  return coerceGid(value, 'ProductVariant')
}

const requireLineItemId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --line-item-id', 2)
  return coerceGid(value, 'CalculatedLineItem')
}

const requireDiscountApplicationId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --discount-application-id', 2)
  return coerceGid(value, 'CalculatedDiscountApplication')
}

const requireShippingLineId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --shipping-line-id', 2)
  return coerceGid(value, 'CalculatedShippingLine')
}

const parseQuantity = (value: unknown, flag: string, { allowZero = false } = {}) => {
  if (value === undefined || value === null || value === '') throw new CliError(`Missing ${flag}`, 2)
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new CliError(`${flag} must be an integer`, 2)
  }
  if (allowZero ? n < 0 : n <= 0) {
    throw new CliError(`${flag} must be ${allowZero ? '0 or greater' : 'a positive integer'}`, 2)
  }
  return n
}

const parseJsonFlag = (value: unknown, flag: string) => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  try {
    return JSON.parse(value)
  } catch (err) {
    throw new CliError(`${flag} must be valid JSON: ${(err as Error).message}`, 2)
  }
}

export const runOrderEdit = async ({
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
        '  shop order-edit <verb> [flags]',
        '',
        'Verbs:',
        '  begin|get|commit|session',
        '  add-variant|add-custom-item|set-quantity',
        '  add-discount|remove-discount|update-discount',
        '  remove-line-item-discount',
        '  add-shipping|remove-shipping|update-shipping',
        '',
        'Workflow:',
        '  1) begin → 2) apply changes → 3) commit',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'session') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const idRaw = args.id as string | undefined
    if (!idRaw) throw new CliError('Missing --id', 2)

    const result = await runQuery(ctx, {
      orderEditSession: { __args: { id: idRaw }, id: true },
    })
    if (result === undefined) return
    printNode({ node: result.orderEditSession, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CalculatedOrder')
    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      node: {
        __args: { id },
        __typename: true,
        on_CalculatedOrder: selection,
      },
    })
    if (result === undefined) return

    const node = result.node
    if (!node || node.__typename !== 'CalculatedOrder') {
      throw new CliError('Node is not a CalculatedOrder', 2)
    }

    printNode({ node, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'begin') {
    const args = parseStandardArgs({ argv, extraOptions: { 'order-id': { type: 'string' } } })
    const id = requireOrderId(args['order-id'])
    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditBegin: {
        __args: { id },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditBegin, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditBegin?.calculatedOrder?.id ?? '')
    printJson(result.orderEditBegin, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-line-item-discount') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'discount-application-id': { type: 'string' } },
    })
    const id = requireId(args.id, 'CalculatedOrder')
    const discountApplicationId = requireDiscountApplicationId((args as any)['discount-application-id'])

    const result = await runMutation(ctx, {
      orderEditRemoveLineItemDiscount: {
        __args: { id, discountApplicationId },
        calculatedOrder: { id: true },
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.orderEditRemoveLineItemDiscount,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.orderEditRemoveLineItemDiscount?.calculatedOrder?.id ?? '')
    printJson(result.orderEditRemoveLineItemDiscount, ctx.format !== 'raw')
    return
  }

  if (verb === 'commit') {
    const args = parseStandardArgs({ argv, extraOptions: { 'staff-note': { type: 'string' }, 'notify-customer': { type: 'boolean' } } })
    const id = requireId(args.id, 'CalculatedOrder')

    const result = await runMutation(ctx, {
      orderEditCommit: {
        __args: {
          id,
          staffNote: args['staff-note'] as any,
          notifyCustomer: args['notify-customer'] ? true : undefined,
        },
        order: orderSummarySelection,
        successMessages: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditCommit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditCommit?.order?.id ?? '')
    printJson(result.orderEditCommit, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-variant') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'variant-id': { type: 'string' },
        quantity: { type: 'string' },
        'location-id': { type: 'string' },
        'allow-duplicates': { type: 'boolean' },
      },
    })
    const id = requireId(args.id, 'CalculatedOrder')
    const variantId = requireVariantId(args['variant-id'])
    const quantity = parseQuantity(args.quantity, '--quantity', { allowZero: true })
    const locationId = args['location-id'] ? coerceGid(args['location-id'], 'Location') : undefined

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditAddVariant: {
        __args: {
          id,
          variantId,
          quantity,
          locationId,
          allowDuplicates: args['allow-duplicates'] ? true : undefined,
        },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditAddVariant, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditAddVariant?.calculatedOrder?.id ?? '')
    printJson(result.orderEditAddVariant, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-custom-item') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        title: { type: 'string' },
        price: { type: 'string' },
        quantity: { type: 'string' },
        taxable: { type: 'boolean' },
        'requires-shipping': { type: 'boolean' },
        'location-id': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'CalculatedOrder')
    const title = args.title as string | undefined
    if (!title) throw new CliError('Missing --title', 2)
    const price = parseJsonFlag(args.price, '--price')
    const quantity = parseQuantity(args.quantity, '--quantity')
    const locationId = args['location-id'] ? coerceGid(args['location-id'], 'Location') : undefined

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditAddCustomItem: {
        __args: {
          id,
          title,
          price,
          quantity,
          locationId,
          taxable: args.taxable ? true : undefined,
          requiresShipping: args['requires-shipping'] ? true : undefined,
        },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditAddCustomItem, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditAddCustomItem?.calculatedOrder?.id ?? '')
    printJson(result.orderEditAddCustomItem, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-quantity') {
    const args = parseStandardArgs({ argv, extraOptions: { 'line-item-id': { type: 'string' }, quantity: { type: 'string' }, restock: { type: 'boolean' } } })
    const id = requireId(args.id, 'CalculatedOrder')
    const lineItemId = requireLineItemId(args['line-item-id'])
    const quantity = parseQuantity(args.quantity, '--quantity')

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditSetQuantity: {
        __args: { id, lineItemId, quantity, restock: args.restock ? true : undefined },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditSetQuantity, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditSetQuantity?.calculatedOrder?.id ?? '')
    printJson(result.orderEditSetQuantity, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-discount') {
    const args = parseStandardArgs({ argv, extraOptions: { 'line-item-id': { type: 'string' } } })
    const id = requireId(args.id, 'CalculatedOrder')
    const lineItemId = requireLineItemId(args['line-item-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditAddLineItemDiscount: {
        __args: { id, lineItemId, discount: built.input },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditAddLineItemDiscount, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditAddLineItemDiscount?.calculatedOrder?.id ?? '')
    printJson(result.orderEditAddLineItemDiscount, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-discount') {
    const args = parseStandardArgs({ argv, extraOptions: { 'discount-application-id': { type: 'string' } } })
    const id = requireId(args.id, 'CalculatedOrder')
    const discountApplicationId = requireDiscountApplicationId(args['discount-application-id'])

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditRemoveDiscount: {
        __args: { id, discountApplicationId },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditRemoveDiscount, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditRemoveDiscount?.calculatedOrder?.id ?? '')
    printJson(result.orderEditRemoveDiscount, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-discount') {
    const args = parseStandardArgs({ argv, extraOptions: { 'discount-application-id': { type: 'string' } } })
    const id = requireId(args.id, 'CalculatedOrder')
    const discountApplicationId = requireDiscountApplicationId(args['discount-application-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditUpdateDiscount: {
        __args: { id, discountApplicationId, discount: built.input },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditUpdateDiscount, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditUpdateDiscount?.calculatedOrder?.id ?? '')
    printJson(result.orderEditUpdateDiscount, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CalculatedOrder')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditAddShippingLine: {
        __args: { id, shippingLine: built.input },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditAddShippingLine, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditAddShippingLine?.calculatedOrder?.id ?? '')
    printJson(result.orderEditAddShippingLine, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: { 'shipping-line-id': { type: 'string' } } })
    const id = requireId(args.id, 'CalculatedOrder')
    const shippingLineId = requireShippingLineId(args['shipping-line-id'])

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditRemoveShippingLine: {
        __args: { id, shippingLineId },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditRemoveShippingLine, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditRemoveShippingLine?.calculatedOrder?.id ?? '')
    printJson(result.orderEditRemoveShippingLine, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-shipping') {
    const args = parseStandardArgs({ argv, extraOptions: { 'shipping-line-id': { type: 'string' } } })
    const id = requireId(args.id, 'CalculatedOrder')
    const shippingLineId = requireShippingLineId(args['shipping-line-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'order-edit',
      view: ctx.view,
      baseSelection: getCalculatedOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      orderEditUpdateShippingLine: {
        __args: { id, shippingLineId, shippingLine: built.input },
        calculatedOrder: selection,
        orderEditSession: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderEditUpdateShippingLine, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderEditUpdateShippingLine?.calculatedOrder?.id ?? '')
    printJson(result.orderEditUpdateShippingLine, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for order-edit: ${verb}`, 2)
}
