import { describe, expect, it } from "vitest";
import path from "node:path";
import { listDir, mtimeOrNull, readFrom, readTextOrNull } from "../../../server/source/fileSource.ts";
import { MACHINE } from "../fixtures.ts";

const missing = path.join(MACHINE, "does-not-exist");

describe("fileSource", () => {
  it("reads as null or empty when a path is missing", async () => {
    expect(await readTextOrNull(missing)).toBeNull();
    expect(await listDir(missing)).toEqual([]);
    expect(await mtimeOrNull(missing)).toBeNull();
    expect(await readFrom(missing, 0, 10)).toBeNull();
  });

  it("reads a slice, clamping the offset into the file", async () => {
    const file = path.join(MACHINE, "logs/beta-agent/notes.txt");
    expect(await readFrom(file, 0, 3)).toEqual({ text: "not", nextOffset: 3 });
    expect(await readFrom(file, -5, 3)).toEqual({ text: "not", nextOffset: 3 });
    expect(await readFrom(file, 999, 3)).toEqual({ text: "", nextOffset: 10 });
  });
});
