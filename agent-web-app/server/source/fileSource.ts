import { readFile, readdir, stat, open } from "node:fs/promises";

/** Thin, non-throwing file reads over the machine's agent outputs. A missing file reads as null or an empty list. */
export async function readTextOrNull(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

export async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export async function mtimeOrNull(file: string): Promise<Date | null> {
  try {
    return (await stat(file)).mtime;
  } catch {
    return null;
  }
}

/** Reads up to `maxBytes` from `offset`; returns the text and the offset just past it. */
export async function readFrom(file: string, offset: number, maxBytes: number): Promise<{ text: string; nextOffset: number } | null> {
  let handle;
  try {
    handle = await open(file, "r");
  } catch {
    return null;
  }
  try {
    const size = (await handle.stat()).size;
    const start = Math.min(Math.max(offset, 0), size);
    const length = Math.min(size - start, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    return { text: buffer.toString("utf8"), nextOffset: start + length };
  } finally {
    await handle.close();
  }
}
