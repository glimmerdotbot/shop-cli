#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const repoRoot = path.join(__dirname, '..')
const cliPath = path.join(repoRoot, 'src', 'cli.ts')

const tsxBin = process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
const tsxPath = path.join(repoRoot, 'node_modules', '.bin', tsxBin)

if (!fs.existsSync(tsxPath)) {
  console.error(
    `Missing ${path.relative(repoRoot, tsxPath)}. Did you run \`npm ci\`?`,
  )
  process.exit(1)
}

const result = spawnSync(tsxPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)

