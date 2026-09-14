// ============================================================
// Static game/team data. No behaviour, no DOM.
// ============================================================

// The hiscores return skills and a flat "activities" array that mixes bosses
// with minigames and clue scrolls. Membership here is what splits the two.
export const BOSS_NAMES = new Set([
  "Abyssal Sire", "Alchemical Hydra", "Amoxliatl", "Araxxor", "Artio",
  "Barrows Chests", "Bryophyta", "Callisto", "Calvar'ion", "Cerberus",
  "Chambers of Xeric", "Chambers of Xeric: Challenge Mode", "Chaos Elemental",
  "Chaos Fanatic", "Commander Zilyana", "Corporeal Beast", "Crazy Archaeologist",
  "Dagannoth Prime", "Dagannoth Rex", "Dagannoth Supreme", "Deranged Archaeologist",
  "Doom of Mokhaiotl", "Duke Sucellus", "General Graardor", "Giant Mole",
  "Grotesque Guardians", "Hespori", "Kalphite Queen", "King Black Dragon",
  "Kraken", "Kree'Arra", "K'ril Tsutsaroth", "Lunar Chests", "Mimic", "Nex",
  "Nightmare", "Phosani's Nightmare", "Obor", "Phantom Muspah", "Sarachnis",
  "Scorpia", "Scurrius", "Shellbane Gryphon", "Skotizo", "Sol Heredit",
  "Spindel", "Tempoross", "The Gauntlet", "The Corrupted Gauntlet",
  "The Hueycoatl", "The Leviathan", "Theatre of Blood",
  "Theatre of Blood: Hard Mode", "Thermonuclear Smoke Devil", "The Royal Titans",
  "The Whisperer", "Tombs of Amascut", "Tombs of Amascut: Expert Mode",
  "TzKal-Zuk", "TzTok-Jad", "Vardorvis", "Venenatis", "Vet'ion", "Vorkath",
  "Wintertodt", "Yama", "Zalcano", "Zulrah"
]);

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

// Skill grid order used by the picker and the Total view (3 columns).
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
  { id: "gim", label: "GIM" }
];

// Categories that show a single cycling item rather than an aggregate view.
export const ITEM_CATEGORIES = new Set(["skills", "bosses", "activities"]);
