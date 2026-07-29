#!/usr/bin/env node
// Pulls NYC 311 service requests from the Socrata Open Data API for the past
// N hours and writes them to a local JSON file for offline analysis.
//
// Usage:
//   node pull-nyc-311-data.js [--hours 6] [--out <path>]
//
// Optional: set SOCRATA_APP_TOKEN to raise Socrata's unauthenticated rate limit.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ENDPOINT = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";
const PAGE_SIZE = 5000;
const PAGE_DELAY_MS = 200;

function parseArgs(argv) {
  const args = { hours: 6, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--hours") args.hours = Number(argv[++i]);
    else if (argv[i] === "--out") args.out = argv[++i];
    else throw new Error(`Unrecognized argument: ${argv[i]}`);
  }
  if (!Number.isFinite(args.hours) || args.hours <= 0) {
    throw new Error(`--hours must be a positive number, got: ${argv}`);
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SoQL's floating_timestamp type rejects milliseconds/timezone suffixes
// (e.g. from Date#toISOString()) as a text/timestamp mismatch.
function toSoqlTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

async function fetchPage(sinceIso, offset) {
  const params = new URLSearchParams({
    $where: `created_date > '${sinceIso}'`,
    $order: "created_date ASC, unique_key ASC",
    $limit: String(PAGE_SIZE),
    $offset: String(offset),
  });
  const headers = {};
  if (process.env.SOCRATA_APP_TOKEN) {
    headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  }
  const res = await fetch(`${ENDPOINT}?${params}`, { headers });
  if (!res.ok) {
    throw new Error(`Socrata request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// The Socrata feed lags real-world "now" by a variable publish delay (often
// a day+), so anchor the window on the latest record actually in the dataset
// rather than the wall clock, or a small --hours window can come back empty.
async function fetchLatestCreatedDate() {
  const params = new URLSearchParams({
    $order: "created_date DESC",
    $limit: "1",
    $select: "created_date",
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) {
    throw new Error(`Socrata request failed: ${res.status} ${res.statusText}`);
  }
  const [row] = await res.json();
  if (!row) throw new Error("Dataset returned no records to anchor the window on.");
  return new Date(`${row.created_date}Z`);
}

async function pullSince(sinceDate) {
  const sinceIso = toSoqlTimestamp(sinceDate);
  const records = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage(sinceIso, offset);
    records.push(...page);
    console.log(`  fetched ${page.length} records (total so far: ${records.length})`);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(PAGE_DELAY_MS);
  }
  return records;
}

async function main() {
  const { hours, out } = parseArgs(process.argv.slice(2));
  const latest = await fetchLatestCreatedDate();
  const since = new Date(latest.getTime() - hours * 60 * 60 * 1000);

  console.log(`Latest record in the dataset is from ${latest.toISOString()}.`);
  console.log(`Pulling NYC 311 records created since ${since.toISOString()} (${hours} hour(s))...`);
  const records = await pullSince(since);

  const dataDir = path.dirname(fileURLToPath(import.meta.url));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultName = `nyc-311-${hours}h-${stamp}.json`;
  const outPath = out ? path.resolve(out) : path.join(dataDir, defaultName);

  const payload = {
    pulled_at: new Date().toISOString(),
    hours_requested: hours,
    since: since.toISOString(),
    record_count: records.length,
    source: ENDPOINT,
    records,
  };

  await writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${records.length} records to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
