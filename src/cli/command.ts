import path from 'node:path'

const DEFAULT_COMMAND = 'shop'

export const resolveCliCommand = (
  opts: {
    env?: NodeJS.ProcessEnv
    argv?: string[]
  } = {},
): string => {
  const env = opts.env ?? process.env
  const argv = opts.argv ?? process.argv

  const fromEnv = env.SHOP_CLI_COMMAND?.trim()
  if (fromEnv) return fromEnv

  const argv1 = argv[1]
  if (typeof argv1 === 'string' && argv1) {
    const base = path.basename(argv1)
    const stripped = base.replace(/\.(js|cjs|mjs|ts)$/i, '')
    if (stripped) return stripped
  }

  return DEFAULT_COMMAND
}

export const formatCommandRef = (text: string, command: string): string => {
  if (!command || command === DEFAULT_COMMAND) return text

  let out = text

  // Replace a leading `shop` command token (allowing indentation), e.g. "  shop products list"
  out = out.replace(/^(\s*)shop(?=(\s|$))/, (_m, indent: string) => `${indent}${command}`)

  // Replace command references inside inline code spans, e.g. `shop products list`
  out = out.replace(/`shop(?=(\s|`))/g, '`' + command)

  return out
}
