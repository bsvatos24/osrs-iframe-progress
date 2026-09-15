#!/usr/bin/env node
// ============================================================
// Regenerates wwwroot/js/hiscore-data.js from a RuneLite checkout.
//
// The hiscores return one flat `activities` array that mixes bosses with
// minigames, clue scrolls and points tables, and nothing in the payload says
// which is which. That split was hand-maintained here, which meant every new
// boss silently landed under Activities until somebody noticed.
//
// RuneLite already keeps an authoritative, typed list in HiscoreSkill.java, so
// take it from there instead of guessing.
//
// Usage:
//   git clone --depth 1 https://github.com/runelite/runelite /tmp/runelite
//   node tools/sync-hiscore-data.mjs /tmp/runelite
// ============================================================

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node tools/sync-hiscore-data.mjs <path-to-runelite-checkout>");
  process.exit(1);
}

const SKILL_FILE = "runelite-client/src/main/java/net/runelite/client/hiscore/HiscoreSkill.java";
const SPRITE_FILE = "runelite-api/src/main/java/net/runelite/api/gameval/SpriteID.java";
const OUT = "wwwroot/js/hiscore-data.js";

// --- Sprite IDs: `_12 = 4272;` numeric constants plus `ZULRAH = _12;` aliases,
// grouped into nested `public static final class` blocks.
function parseSpriteIds(src) {
  const byClass = new Map();
  const classRe = /public static final class (\w+)\s*\{/g;
  let m;
  while ((m = classRe.exec(src)) !== null) {
    const name = m[1];
    // Walk to the matching close brace.
    let depth = 1;
    let i = classRe.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const block = src.slice(classRe.lastIndex, i);
    const nums = new Map();
    for (const [, k, v] of block.matchAll(/int (_\d+) = (\d+);/g)) nums.set(k, Number(v));
    const named = new Map();
    for (const [, k, ref] of block.matchAll(/int ([A-Z][A-Z0-9_]*) = (_\d+);/g)) {
      if (nums.has(ref)) named.set(k, nums.get(ref));
    }
    for (const [, k, v] of block.matchAll(/int ([A-Z][A-Z0-9_]*) = (\d+);/g)) named.set(k, Number(v));
    byClass.set(name, named);
  }
  return byClass;
}

const skillSrc = readFileSync(join(root, SKILL_FILE), "utf8");
const spriteIds = parseSpriteIds(readFileSync(join(root, SPRITE_FILE), "utf8"));

// --- The enum: NAME("Display Name", TYPE, SpriteID.Class.CONST)
const body = skillSrc.slice(skillSrc.indexOf("public enum HiscoreSkill"));
const entries = [];
// The sprite argument is optional: the clue-scroll tiers use a two-arg
// constructor and have no icon of their own.
const entryRe =
  /^\t([A-Z0-9_]+)\("([^"]+)",\s*(?:HiscoreSkillType\.)?([A-Z]+)\s*(?:,\s*SpriteID\.(\w+)\.(\w+)\s*)?\)/gm;
for (const [, , label, type, spriteClass, spriteConst] of body.matchAll(entryRe)) {
  entries.push({
    label,
    type,
    spriteId: spriteClass ? (spriteIds.get(spriteClass)?.get(spriteConst) ?? null) : null
  });
}

if (entries.length < 100) {
  console.error(`only parsed ${entries.length} entries - HiscoreSkill.java format may have changed`);
  process.exit(1);
}

const pick = (t) => entries.filter((e) => e.type === t).map((e) => e.label);
const skills = pick("SKILL");
const activities = pick("ACTIVITY");
const bosses = pick("BOSS");

// Which entries have no icon committed. RuneLite ships no boss art - its
// hiscore panel reads sprites from the running game's cache by id - so newly
// released bosses have no file here until one is added by hand. Recording them
// lets the app draw its monogram fallback directly instead of firing a request
// that 404s on every page load.
function slug(name) {
  return name.toLowerCase().replace(/[:'()]/g, "").replace(/\s+/g, "-");
}

const iconDirs = {
  skills: "wwwroot/icons/skills",
  activities: "wwwroot/icons/activities"
};
const haveSkill = new Set(readdirSync(iconDirs.skills));
const haveActivity = new Set(readdirSync(iconDirs.activities));

const iconless = entries
  .filter((e) => {
    const file = slug(e.label) + ".png";
    if (e.type === "SKILL") return !haveSkill.has(file);
    if (e.type === "OVERALL") return false;
    return !haveActivity.has(file);
  })
  .map((e) => e.label);

const list = (names) => names.map((n) => `  ${JSON.stringify(n)}`).join(",\n");
const spriteMap = entries
  .filter((e) => e.spriteId != null)
  .map((e) => `  ${JSON.stringify(e.label)}: ${e.spriteId}`)
  .join(",\n");

writeFileSync(OUT, `// ============================================================
// GENERATED FILE - do not edit by hand.
//
// Source: RuneLite's HiscoreSkill.java, which is the authoritative typed list
// of every hiscore entry. Regenerate with:
//
//   git clone --depth 1 https://github.com/runelite/runelite /tmp/runelite
//   node tools/sync-hiscore-data.mjs /tmp/runelite
//
// Entries: ${skills.length} skills, ${activities.length} activities, ${bosses.length} bosses.
// ============================================================

export const SKILL_NAMES = [
${list(skills)}
];

// Minigames, clue scrolls and points tables - everything the hiscores return
// under "activities" that is not a boss.
export const ACTIVITY_NAMES = [
${list(activities)}
];

export const BOSS_NAME_LIST = [
${list(bosses)}
];

// Sprite id in the game cache for each entry. RuneLite does not ship these as
// image files - its hiscore panel pulls them from the running client's sprite
// cache by id - so this is only a lookup for sourcing art by hand.
export const SPRITE_IDS = {
${spriteMap}
};

// Entries with no icon file committed under wwwroot/icons. The app draws a
// monogram for these rather than requesting a file that does not exist.
// Drop a PNG at the slugged name and re-run the sync to clear it from here.
export const ICONLESS = [
${list(iconless)}
];
`);

console.log(`wrote ${OUT}`);
console.log(`  ${skills.length} skills, ${activities.length} activities, ${bosses.length} bosses`);
console.log(`  ${entries.filter((e) => e.spriteId != null).length}/${entries.length} sprite ids resolved`);
if (iconless.length) {
  console.log(`  ${iconless.length} without an icon file: ${iconless.join(", ")}`);
  console.log("  sprite ids for sourcing art by hand:");
  for (const name of iconless) {
    const e = entries.find((x) => x.label === name);
    console.log(`    ${name} -> sprite ${e?.spriteId ?? "n/a"}`);
  }
}