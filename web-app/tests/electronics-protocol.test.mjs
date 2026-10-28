import test from "node:test";
import assert from "node:assert/strict";
import { boundedJson, validateRequest, TOOLS } from "../public/vendor/design-electronics/protocol.mjs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("shipped engine assets match the pinned manifest and current adapter", async () => {
  const publicRoot=new URL("../public/vendor/design-electronics/",import.meta.url);
  const sourceRoot=new URL("../../third_party/design-electronics/upstream/",import.meta.url);
  const manifest=JSON.parse(await readFile(new URL("engine-manifest.json",publicRoot),"utf8"));
  const lock=JSON.parse(await readFile(new URL("../../third_party/design-electronics/lock.json",import.meta.url),"utf8"));
  assert.equal(manifest.upstream,lock.commit);assert.equal(manifest.emscripten,lock.emscripten);
  for(const [files,root]of [[manifest.artifacts,publicRoot],[manifest.patchedSources,sourceRoot]])for(const file of files){
    const bytes=await readFile(new URL(file.file,root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"),file.sha256,file.file+" needs rebuilding");
    if(file.bytes)assert.equal(bytes.length,file.bytes);
  }
  assert.match(await readFile(new URL("THIRD-PARTY-NOTICES.txt",publicRoot),"utf8"),/FreeType Project/);
});

test("engine bridge rejects untrusted commands and oversized structures", () => {
  for (const request of [null, [], {operation:"open_design",path:"/private"}, {operation:"tool",name:"export",arguments:{path:"/private"}}, {operation:"status",path:"/private"}, {operation:"observe",seconds:Infinity}, {operation:"observe",seconds:6}, {operation:"view",view:4}, {operation:"running",running:1}, {operation:"theme",theme:"auto"}, {operation:"export",format:"gerber",view:"invalid"}]) assert.throws(() => validateRequest(request));
  assert.throws(() => boundedJson(JSON.parse('{"__proto__":{}}')));
  assert.throws(() => boundedJson("x".repeat(65537)));
  assert.throws(() => boundedJson(Array(60001).fill(1)));
  let deep = {}; for (let i=0;i<26;i++) deep = {child:deep};
  assert.throws(() => boundedJson(deep));
  for (const name of TOOLS) assert.equal(validateRequest({operation:"tool",name,arguments:{}}).name,name);
  assert.equal(validateRequest({operation:"observe",seconds:5}).seconds,5);
});
