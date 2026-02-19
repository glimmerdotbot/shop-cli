#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('node:path')
const fs = require('node:fs')

process.env.SHOP_CLI_COMMAND = process.env.SHOP_CLI_COMMAND || 'shop-cli'

const repoRoot = path.join(__dirname, '..')
const cliPath = path.join(repoRoot, 'dist', 'cli.js')

if (!fs.existsSync(cliPath)) {
  console.error(`Missing ${path.relative(repoRoot, cliPath)}. Did you run \`npm run build\`?`)
  process.exit(1)
}

require(cliPath)

