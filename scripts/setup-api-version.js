const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

/**
 * Sets up a new Shopify Admin API version:
 * 1. Downloads the GraphQL schema
 * 2. Generates the introspection JSON
 * 3. Generates TypeScript client code
 *
 * Usage:
 *   npm run schema:setup -- <YYYY-MM>
 *   npm run schema:setup -- 2026-04
 */

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run schema:setup -- <YYYY-MM>",
      "  npm run schema:setup -- --version <YYYY-MM>",
      "",
      "Example:",
      "  npm run schema:setup -- 2026-04",
      "",
      "This command will:",
      "  1. Download the GraphQL schema from Shopify",
      "  2. Generate introspection JSON for validation",
      "  3. Generate TypeScript client code",
    ].join("\n"),
  );
}

function parseVersion(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };

  const equalsArg = argv.find((arg) => arg.startsWith("--version="));
  if (equalsArg) return { version: equalsArg.slice("--version=".length) };

  const versionFlagIndex = argv.findIndex(
    (arg) => arg === "--version" || arg === "-v",
  );
  if (versionFlagIndex !== -1) {
    const version = argv[versionFlagIndex + 1];
    return { version };
  }

  const [first] = argv;
  return { version: first };
}

function runCommand(command, args, description) {
  console.log(`\n→ ${description}...`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`Failed: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    console.error(`Failed with exit code ${result.status}`);
    return false;
  }

  return true;
}

async function main() {
  const { help, version } = parseVersion(process.argv.slice(2));
  if (help) {
    printUsage();
    return;
  }

  if (!version) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  // Validate version format
  if (!/^\d{4}-\d{2}$/.test(version)) {
    console.error(`Invalid version format: ${version}`);
    console.error("Expected format: YYYY-MM (e.g., 2026-04)");
    process.exitCode = 1;
    return;
  }

  console.log(`Setting up Shopify Admin API version: ${version}`);

  // Step 1: Download schema
  const schemaPath = path.join(process.cwd(), "schema", `${version}.graphql`);
  if (!runCommand("npm", ["run", "schema:admin", "--", version], "Downloading GraphQL schema")) {
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(schemaPath)) {
    console.error(`Schema download failed: ${schemaPath} not found`);
    process.exitCode = 1;
    return;
  }

  // Step 2: Generate introspection JSON
  if (!runCommand("npm", ["run", "schema:introspection", "--", version], "Generating introspection JSON")) {
    process.exitCode = 1;
    return;
  }

  // Step 3: Generate TypeScript client
  const outputDir = path.join(process.cwd(), "src", "generated", `admin-${version}`);
  const genqlBin = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "genql.cmd" : "genql");

  const scalarMappings = [
    "ARN:string",
    "BigInt:string",
    "Color:string",
    "Date:string",
    "DateTime:string",
    "Decimal:string",
    "FormattedString:string",
    "HTML:string",
    "JSON:unknown",
    "Money:string",
    "StorefrontID:string",
    "URL:string",
    "UnsignedInt64:string",
    "UtcOffset:string",
  ];

  const genqlArgs = [
    "--schema", schemaPath,
    "--output", outputDir,
    "--sort",
    ...scalarMappings.flatMap(s => ["-S", s]),
  ];

  if (!runCommand(genqlBin, genqlArgs, "Generating TypeScript client")) {
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ API version ${version} setup complete!`);
  console.log(`\nGenerated files:`);
  console.log(`  - schema/${version}.graphql`);
  console.log(`  - schema/${version}.introspection.json`);
  console.log(`  - src/generated/admin-${version}/`);
}

main();
