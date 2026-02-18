const fs = require("node:fs");
const path = require("node:path");

/**
 * Generates introspection JSON from a GraphQL SDL schema file.
 * The JSON file can be loaded at runtime for fast schema validation.
 *
 * Usage:
 *   node scripts/generate-introspection-json.js [version]
 *   npm run schema:introspection -- 2026-04
 */

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run schema:introspection -- <YYYY-MM>",
      "  npm run schema:introspection -- --version <YYYY-MM>",
      "",
      "Example:",
      "  npm run schema:introspection -- 2026-04",
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

  const schemaDir = path.join(process.cwd(), "schema");
  const sdlFile = path.join(schemaDir, `${version}.graphql`);
  const outputFile = path.join(schemaDir, `${version}.introspection.json`);

  if (!fs.existsSync(sdlFile)) {
    console.error(`Schema file not found: ${sdlFile}`);
    console.error(`Run \`npm run schema:admin -- ${version}\` first.`);
    process.exitCode = 1;
    return;
  }

  // Dynamic import to avoid requiring graphql at module load time
  const { buildSchema, introspectionFromSchema } = await import("graphql");

  console.log(`Reading schema from ${path.relative(process.cwd(), sdlFile)}`);
  const sdl = fs.readFileSync(sdlFile, "utf8");

  console.log("Building schema...");
  const schema = buildSchema(sdl);

  console.log("Generating introspection...");
  const introspection = introspectionFromSchema(schema);

  console.log(
    `Writing introspection to ${path.relative(process.cwd(), outputFile)}`,
  );
  fs.writeFileSync(outputFile, JSON.stringify(introspection));

  const stats = fs.statSync(outputFile);
  console.log(`Done. Output size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
