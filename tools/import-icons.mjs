#!/usr/bin/env node
// ============================================================
// Imports hiscore icons from a Wise Old Man checkout.
//
// Why WOM and not RuneLite: RuneLite's hiscore panel reads its icons from the
// running game client's sprite cache by numeric id, so its repository contains
// no boss art at all - only the 24 skill icons. WOM's web app ships all 117
// hiscore metrics as lossless PNGs, which is the only complete source that can
// be fetched rather than extracted from a game cache.
//
// For the 25 icons both projects have, 23 are pixel-identical and the other
// two differ by at most 11/255, so WOM is used for everything to keep one
// provenance.
//
// Usage:
//   git clone --depth 1 --filter=blob:none --sparse \
//     https://github.com/wise-old-man/wise-old-man /tmp/wom
//   git -C /tmp/wom sparse-checkout set app/public/img/metrics
//   node tools/import-icons.mjs /tmp/wom
// ============================================================

import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node tools/import-icons.mjs <path-to-wise-old-man-checkout>");
  process.exit(1);
}

const SRC = join(root, "app/public/img/metrics");
if (!existsSync(SRC)) {
  console.error(`no icons at ${SRC} - did the sparse-checkout include app/public/img/metrics?`);
  process.exit(1);
}

// WOM names files after its own metric ids, which match the hiscore display
// names once punctuation is stripped - except for these, where it uses the
// in-game name rather than the hiscore label.
const ALIASES = {
  "Runecraft": "runecrafting",
  "LMS - Rank": "last_man_standing",
  "PvP Arena - Rank": "pvp_arena",
  "Rifts closed": "guardians_of_the_rift",
  "Tombs of Amascut: Expert Mode": "tombs_of_amascut_expert"
};

// Must match format.js's slug().
const slug = (name) =>
  name.toLowerCase().replace(/[:'()]/g, "").replace(/\s+/g, "-");

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Authoritative entry lists, themselves generated from RuneLite.
const data = readFileSync("wwwroot/js/hiscore-data.js", "utf8");
const arrayOf = (name) => {
  const start = data.indexOf(`${name} = [`);
  const body = data.slice(start, data.indexOf("];", start));
  return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
};

const targets = [
  ...arrayOf("SKILL_NAMES").map((n) => ({ name: n, dir: "wwwroot/icons/skills" })),
  ...arrayOf("ACTIVITY_NAMES").map((n) => ({ name: n, dir: "wwwroot/icons/activities" })),
  ...arrayOf("BOSS_NAME_LIST").map((n) => ({ name: n, dir: "wwwroot/icons/activities" })),
  // Overall is filtered out of the skill list but its sprite is the Total tab's
  // header icon, under two names.
  { name: "Overall", dir: "wwwroot/icons/skills", as: "overall" },
  { name: "Overall", dir: "wwwroot/icons/skills", as: "total" }
];

const available = new Map();
for (const file of readdirSync(SRC)) {
  if (file.endsWith(".png")) available.set(norm(file.slice(0, -4)), file);
}

let written = 0;
const missing = [];
for (const t of targets) {
  const alias = ALIASES[t.name];
  const file = alias ? `${alias}.png` : available.get(norm(t.name));
  if (!file || !existsSync(join(SRC, file))) {
    missing.push(t.name);
    continue;
  }
  copyFileSync(join(SRC, file), join(t.dir, `${t.as || slug(t.name)}.png`));
  written++;
}

console.log(`imported ${written} icons from ${SRC}`);
if (missing.length) {
  console.log(`  NO SOURCE for ${missing.length}: ${missing.join(", ")}`);
  process.exitCode = 1;
}