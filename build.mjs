import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL(".", import.meta.url)));
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const entryPoints = Object.fromEntries([
  ...manifest.commands.map(({ name }) => [name, `src/${name}.tsx`]),
  ...(manifest.tools ?? []).map(({ name }) => [`tools/${name}`, `src/tools/${name}.ts`]),
]);
await build({
  absWorkingDir: process.cwd(),
  entryPoints,
  outdir: ".",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2022",
  jsx: "automatic",
  alias: { execa: "./src/tinycast-execa.ts" },
  external: ["@raycast/api", "react", "react/jsx-runtime", "react/jsx-dev-runtime"],
  sourcemap: false,
  logLevel: "info",
});
