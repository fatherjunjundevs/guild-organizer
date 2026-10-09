// Test harness only: compile the actual server-only TypeScript without writing
// artifacts or opening a signing endpoint. Next enforces server-only in the app;
// this isolated Node runner supplies that marker's empty test implementation.
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";

const require = createRequire(import.meta.url);
export function loadShareLinkTestModules() {
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const source = readFileSync(new URL(`../src/features/events/${name}.ts`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const compiledModule = { exports: {} };
    const localRequire = (id) => id === "server-only" ? {} : id.startsWith("./share-link-") ? load(id.slice(2)) : require(id);
    new Script(`(function(require,module,exports){${compiled}\n})`, { filename: `${name}.test-runtime.cjs` })
      .runInThisContext()(localRequire, compiledModule, compiledModule.exports);
    modules.set(name, compiledModule.exports);
    return compiledModule.exports;
  }
  return { config: load("share-link-config"), crypto: load("share-link-crypto") };
}
