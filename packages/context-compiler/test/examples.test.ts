import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { compileContext, renderExport, stableStringify, type CompileInput } from "../src/index.js";

const examples = new URL("../../../examples/generated-context/", import.meta.url);

function read(name: string) {
  return readFileSync(fileURLToPath(new URL(name, examples)), "utf8").replace(/\r\n/g, "\n");
}

it("keeps the published example context in sync with the compiler", () => {
  const input = JSON.parse(read("project.json")) as CompileInput;
  const context = compileContext(input);
  expect(stableStringify(context) + "\n").toBe(read("expected-canonical.json"));
  expect(renderExport("generic", context).content).toBe(read("EXPECTED_MASTER_PROMPT.md"));
});
