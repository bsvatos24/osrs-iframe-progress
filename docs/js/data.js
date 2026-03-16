// Boss names to distinguish bosses from activities
const BOSS_NAMES = new Set([
  "Abyssal Sire",
  "Alchemical Hydra",
  "Amoxliatl",
  "Araxxor",
  "Artio",
  "Barrows Chests",
  "Bryophyta",
  "Callisto",
  "Calvar'ion",
  "Cerberus",
  "Chambers of Xeric",
  "Chambers of Xeric: Challenge Mode",
  "Chaos Elemental",
  "Chaos Fanatic",
  "Commander Zilyana",
  "Corporeal Beast",
  "Crazy Archaeologist",
  "Dagannoth Prime",
  "Dagannoth Rex",
  "Dagannoth Supreme",
  "Deranged Archaeologist",
  "Doom of Mokhaiotl",
  "Duke Sucellus",
  "General Graardor",
  "Giant Mole",
  "Grotesque Guardians",
  "Hespori",
  "Kalphite Queen",
  "King Black Dragon",
  "Kraken",
  "Kree'Arra",
  "K'ril Tsutsaroth",
  "Lunar Chests",
  "Mimic",
  "Nex",
  "Nightmare",
  "Phosani's Nightmare",
  "Obor",
  "Phantom Muspah",
  "Sarachnis",
  "Scorpia",
  "Scurrius",
  "Shellbane Gryphon",
  "Skotizo",
  "Sol Heredit",
  "Spindel",
  "Tempoross",
  "The Gauntlet",
  "The Corrupted Gauntlet",
  "The Hueycoatl",
  "The Leviathan",
  "Theatre of Blood",
  "Theatre of Blood: Hard Mode",
  "Thermonuclear Smoke Devil",
  "The Royal Titans",
  "The Whisperer",
  "Tombs of Amascut",
  "Tombs of Amascut: Expert Mode",
  "TzKal-Zuk",
  "TzTok-Jad",
  "Vardorvis",
  "Venenatis",
  "Vet'ion",
  "Vorkath",
  "Wintertodt",
  "Yama",
  "Zalcano",
  "Zulrah"
]);

// Milestone thresholds
const SKILL_MILESTONES = [70, 80, 90, 99];
const KC_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000];

// Player list
const DEFAULT_PLAYER = "BenjiFresh91";
const PLAYER_OPTIONS = [
  "BenjiFresh91",
  "IronBengal",
  "Kobenhamner",
  "Z o i n k z",
  "PacmanPier"
];

// Skill grid order used in picker + total tab
const SKILL_GRID_ORDER = [
  "Attack", "Hitpoints", "Mining",
  "Strength", "Agility", "Smithing",
  "Defence", "Herblore", "Fishing",
  "Ranged", "Thieving", "Cooking",
  "Prayer", "Crafting", "Firemaking",
  "Magic", "Fletching", "Woodcutting",
  "Runecraft", "Slayer", "Farming",
  "Construction", "Hunter", "Sailing"
];

// GIM panel skill order (3 rows x 8 columns)
const GIM_SKILL_ORDER = [
  ["Mining", "Smithing", "Fishing", "Cooking", "Firemaking", "Woodcutting", "Farming", "Sailing"],
  ["Hitpoints", "Agility", "Herblore", "Thieving", "Crafting", "Fletching", "Slayer", "Hunter"],
  ["Attack", "Strength", "Defence", "Ranged", "Prayer", "Magic", "Runecraft", "Construction"]
];

// GIM team members and their positions (die-5 pattern)
const GIM_PLAYERS = [
  { name: "IronBengal", pos: "tl" },
  { name: "Kobenhamner", pos: "tr" },
  { name: "Z o i n k z", pos: "bl" },
  { name: "PacmanPier", pos: "br" },
  { name: "BenjiFresh91", pos: "c" }
];

// All 24 skill names (for fallback data)
const ALL_SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction", "Sailing"
];
