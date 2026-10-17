import { randomBytes } from "node:crypto";

/* Crockford base32, as ULIDs use. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A ULID: 10 characters of millisecond time, then 16 of randomness, so ids
 * sort by creation time (§2 customer side, decision 4). Hand-written
 * rather than a dependency; ordering within one millisecond is not needed.
 */
export function newUlid(now: Date, random: (size: number) => Buffer = randomBytes): string {
  let time = now.getTime();
  let timePart = "";
  for (let i = 0; i < 10; i++) {
    timePart = ALPHABET[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const bytes = random(16);
  let randomPart = "";
  for (let i = 0; i < 16; i++) randomPart += ALPHABET[bytes[i] % 32];
  return timePart + randomPart;
}

/** A random sort-key value for the OpenByBorough index. */
export function newPickKey(random: (size: number) => Buffer = randomBytes): string {
  return random(8).toString("hex");
}
