/* eslint-disable no-console */
const fs = require('node:fs')
const path = require('node:path')

const { build } = require('esbuild')

const repoRoot = path.join(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')
const srcDir = path.join(repoRoot, 'src')

const rmDist = () => {
  fs.rmSync(distDir, { recursive: true, force: true })
}

const walkTsFiles = (dir) => {
  /** @type {string[]} */
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Exclude tests and fixtures from publish build
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === '__tests__') continue
      files.push(...walkTsFiles(path.join(dir, entry.name)))
      continue
    }
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.test.ts')) continue
    files.push(path.join(dir, entry.name))
  }
  return files
}

const copyRuntimeAssets = () => {
  const srcSchemaGraphql = path.join(repoRoot, 'src', 'generated', 'admin-2026-04', 'schema.graphql')
  const distSchemaGraphql = path.join(repoRoot, 'dist', 'generated', 'admin-2026-04', 'schema.graphql')

  fs.mkdirSync(path.dirname(distSchemaGraphql), { recursive: true })
  fs.copyFileSync(srcSchemaGraphql, distSchemaGraphql)
}

const run = async () => {
  rmDist()

  const entryPoints = walkTsFiles(srcDir)
  if (entryPoints.length === 0) {
    throw new Error('No TypeScript entry points found under src/')
  }

  await build({
    entryPoints,
    outdir: distDir,
    outbase: srcDir,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    sourcemap: true,
    logLevel: 'info',
  })

  copyRuntimeAssets()

  // Generate .d.ts into dist/ matching the JS layout
  const { spawnSync } = require('node:child_process')
  const tscBin = process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
  const tscPath = path.join(repoRoot, 'node_modules', '.bin', tscBin)

  const result = spawnSync(tscPath, ['-p', 'tsconfig.declarations.json'], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  console.log('Build complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

