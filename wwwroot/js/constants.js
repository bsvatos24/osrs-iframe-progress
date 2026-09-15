// ============================================================
// Static game/team data. No behaviour, no DOM.
// ============================================================

import { ACTIVITY_NAMES, BOSS_NAME_LIST, SKILL_NAMES } from "./hiscore-data.js";

// Boss / activity classification comes from RuneLite's HiscoreSkill.java via
// tools/sync-hiscore-data.mjs. The hiscores return one flat "activities" array
// mixing bosses with minigames and clue scrolls, and say nothing about which is
// which - so this used to be a hand-kept list, which meant every new boss
// landed under Activities until someone noticed. Brutus, Mad Angel and Maggot
// King all did.
export const BOSS_NAMES = new Set(BOSS_NAME_LIST);

// Activity rows whose "score" is a rank or a running points balance rather
// than a count of anything, so adding them to a total is meaningless. This
// is a semantic judgement RuneLite does not record, so it stays by hand - but
// it is validated against the generated list below, which catches names that
// the hiscores have since renamed or dropped.
const NON_COUNT_CANDIDATES = [
  "League Points",
  "LMS - Rank",
  "PvP Arena - Rank",
  "Colosseum Glory",
  "Bounty Hunter - Hunter",
  "Bounty Hunter - Rogue"
];

const ACTIVITY_SET = new Set(ACTIVITY_NAMES);
export const NON_COUNT_ACTIVITIES = new Set(
  NON_COUNT_CANDIDATES.filter(function (name) { return ACTIVITY_SET.has(name); })
);

// The team. Single source of truth: the player picker and the GIM layout are
// both derived from this, so adding a member is one edit.
// `pos` places the member in the GIM view's die-5 pattern.
export const TEAM = [
  { name: "BenjiFresh91", pos: "c", owner: true },
  { name: "IronBengal", pos: "tl" },
  { name: "Kobenhamner", pos: "tr" },
  { name: "Z o i n k z", pos: "bl" },
  { name: "PacmanPier", pos: "br" }
];

// Die-5 slot order, assigned to the roster in order. Kept separate from TEAM
// so an arbitrary ?players= list still gets sensible positions.
export const GIM_POSITIONS = ["c", "tl", "tr", "bl", "br"];

export const DEFAULT_PLAYER = (TEAM.find(function (m) { return m.owner; }) || TEAM[0]).name;
export const PLAYER_OPTIONS = TEAM.map(function (m) { return m.name; });

// Curated display orders. These are layout choices, not data - but a skill
// missing from one would silently vanish from that view, so both are checked
// against SKILL_NAMES at load.
export const SKILL_GRID_ORDER = [
  "Attack", "Hitpoints", "Mining",
  "Strength", "Agility", "Smithing",
  "Defence", "Herblore", "Fishing",
  "Ranged", "Thieving", "Cooking",
  "Prayer", "Crafting", "Firemaking",
  "Magic", "Fletching", "Woodcutting",
  "Runecraft", "Slayer", "Farming",
  "Construction", "Hunter", "Sailing"
];

// GIM panel skill order (3 rows x 8 columns), grouped gathering / support / combat.
export const GIM_SKILL_ORDER = [
  ["Mining", "Smithing", "Fishing", "Cooking", "Firemaking", "Woodcutting", "Farming", "Sailing"],
  ["Hitpoints", "Agility", "Herblore", "Thieving", "Crafting", "Fletching", "Slayer", "Hunter"],
  ["Attack", "Strength", "Defence", "Ranged", "Prayer", "Magic", "Runecraft", "Construction"]
];

export const CATEGORIES = [
  { id: "skills", label: "Skills" },
  { id: "bosses", label: "Bosses" },
  { id: "activities", label: "Activities" },
  { id: "total", label: "Total" },
  { id: "gim", label: "GIM" },
  { id: "team", label: "Team" }
];

// Views that need every member's hiscores rather than just the selected one.
export const TEAM_CATEGORIES = new Set(["gim", "team"]);

// What the Team view can be measured by.
export const TEAM_METRICS = [
  { id: "skills", label: "Skills" },
  { id: "bosses", label: "Bosses" },
  { id: "activities", label: "Activities" }
];

// Categories that show a single cycling item rather than an aggregate view.
export const ITEM_CATEGORIES = new Set(["skills", "bosses", "activities"]);

// --- Development guard -----------------------------------------------------
// A skill added to the game (Sailing was the last) must be placed in both
// curated orders. Failing loudly here beats a skill quietly missing from the
// Total or GIM views.
const declared = new Set(SKILL_NAMES);
[["SKILL_GRID_ORDER", SKILL_GRID_ORDER], ["GIM_SKILL_ORDER", GIM_SKILL_ORDER.flat()]]
  .forEach(function (pair) {
    const missing = SKILL_NAMES.filter(function (n) { return !pair[1].includes(n); });
    const unknown = pair[1].filter(function (n) { return !declared.has(n); });
    if (missing.length || unknown.length) {
      console.warn("[constants] " + pair[0] + " is out of sync with the hiscores:",
        { missing: missing, unknown: unknown });
    }
  });
