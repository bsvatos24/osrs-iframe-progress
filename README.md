# OSRS Group Ironman Progress Dashboard

A zero-build static dashboard for Old School RuneScape hiscore data, serving two
consumers from one deploy:

- an **iframe widget** on a [CORSAIR XENEON EDGE](https://www.corsair.com/) — a
  14.5" 2560x720 touch panel driven by iCUE
- a **shared webpage** the rest of the group ironman team opens in a browser

## Views

| Tab | Shows |
|---|---|
| Skills | One skill at a time: XP within the current level, XP toward 99 (or toward 200m once 99'd), and level milestones |
| Bosses | Kill count progress to the next KC milestone, plus global rank |
| Activities | Same as Bosses, for minigames, clue scrolls and points tables |
| Total | All 24 skills with level and intra-level progress, plus total level and XP |
| GIM | Every team member's skills side by side with their totals |
| Team | Everyone ranked by a metric you choose from the footer dropdown - **Skills** (total level, XP, gains, plus an "about to level" board), **Bosses** (total KC, unique bosses, plus the team's most-killed) or **Activities** (clues, collections, plus most-completed) |

In kiosk mode the current category auto-cycles every 6 seconds; **Pin** freezes
it, the grid button opens a searchable picker, and the player dropdown switches
accounts. Pinning remembers *which* entry is pinned, so switching to a teammate
lands on the same skill or boss rather than resetting to the first one. In web
mode cycling is off by default so the view does not move while you are reading
it. On the Team tab the player dropdown becomes the metric dropdown, since a
single player means nothing on that view.

## Running locally

The app uses ES modules, so it needs to be served over HTTP — opening
`index.html` from the filesystem will not work.

```sh
npx http-server -p 8099 -s .
# then open http://127.0.0.1:8099/index.html
```

## Deploying

`.github/workflows/deploy.yml` publishes the repository root to GitHub Pages on
every push to `main`. There is no build step: what is committed is what is served.

## Dual mode

One deploy serves both consumers, along two independent axes. They are kept
separate on purpose: "am I in an iframe" and "how much room do I have" are
different questions, and an M Edge slot (840x696) and a phone (390x844) are
both narrow while needing opposite layouts.

### `mode` - behaviour

Resolved from `?mode=`, then a remembered choice, then `window.self !== window.top`.
Exposed as `data-mode` on `<html>`.

| | `kiosk` | `web` |
|---|---|---|
| Auto-cycle | on, 6s | off |
| Auto-refresh | 5 min | 10 min |
| Scrolling | locked | normal |
| Hit targets | 44px minimum | mouse-sized, hover enabled |
| Text selection | off | on |

### Layout bucket - from the container, not the device

A single `ResizeObserver` on `#app` classifies by aspect ratio and sets
`data-bucket`, so CSS and the JS that decides how many GIM panels fit can never
disagree. All three Edge slots are 696px tall, so aspect maps straight onto them.

| Bucket | Aspect | Slot | Item views | GIM |
|---|---|---|---|---|
| `xl` | >= 3.0 | XL 2536x696 | big gauges, milestone row hugs content | 5 panels in one row, 4 columns of skills each |
| `l` | 2.0 - 3.0 | **L 1688x696 (deployed)** | same | 3 over 2, 8 columns each |
| `m` | 1.0 - 2.0 | M 840x696, desktop | 2-up gauges over a full-width milestone bar | one member at a time, cycling, 6 columns |
| `tall` | < 1.0 | phones | single column, scrollable | stacked |

## Configuration

Every option is settable from the query string, which is what lets one deploy
drive several different widget slots without a code change per slot.

| Parameter | Default | Meaning |
|---|---|---|
| `player` | `BenjiFresh91` | starting player |
| `players` | the `TEAM` roster | comma-separated roster override |
| `view` | `skills` | `skills`/`bosses`/`activities`/`total`/`gim`/`team` |
| `item` | - | slug to pin to, e.g. `slayer`, `zulrah` |
| `cycle` | 6 (kiosk), 0 (web) | seconds per auto-cycle step; 0 is off |
| `refresh` | 300 (kiosk), 600 (web) | seconds between polls; 0 is off |
| `mode` | auto-detected | `kiosk` or `web` |
| `chrome` | `1` | `0` hides all controls - a pure display widget |
| `bucket` | auto | force `xl`/`l`/`m`/`tall` (debugging) |
| `gim` | auto by bucket | `panels`/`cycle`/`summary` |
| `all` | `0` | `1` includes bosses/activities with no kills |
| `theme` | `ef50e7` | accent colour, hex without the `#` |

## Embedding on the XENEON EDGE

Open **`setup.html`** on the deployed site. It previews the dashboard at each
iCUE slot size (M 840x696, L 1688x696, XL 2536x696), lets you pick the view and
options, and emits the snippet to paste into the iCUE **IFRAME** widget.

`setup.html` is a tool, **not** the page you embed — the snippet it generates
always points at `index.html`:

```html
<iframe src="https://<your-pages-url>/index.html?view=gim&mode=kiosk"
        width="100%" height="100%" frameborder="0"></iframe>
```

It is also the way to check all three slot layouts without swapping the live
widget. (`embed.html` redirects here; the old name read as "the page you
embed", which it never was.)

### Keep the tab bar

`chrome=0` hides **all** controls — the tab bar, Pin/Prev/Next and the player
menu — for a pure display widget. Leave it off if you want to change tabs by
touch:

```
?view=gim&mode=kiosk              tab bar visible
?view=gim&mode=kiosk&chrome=0     no controls at all
```

Either way the screen stays navigable by gesture: swipe up/down to change tab,
left/right to change item. So `chrome=0` costs you the buttons, not the
navigation.

### Example slot setups

```
?view=team&chrome=0                     standings, gains and what is about to level
?view=gim&chrome=0                      full team skill grid, no controls
?view=skills&item=slayer&chrome=0       one always-on gauge for the current grind
?view=gim&gim=summary&chrome=0          compact five-row team leaderboard
?view=total                             one interactive slot, controls on
```

## Controls

Touch: swipe left/right to change item, up/down to change tab.
Keyboard: arrow keys to change item, `R` to refresh, `P` to pin.

## Progress history

The hiscores are point-in-time only: they say what you have, never what you
gained. The app stores one snapshot per player per day in `localStorage` and
diffs against it, which is what powers the Team view's "today" and "7 days"
columns.

Snapshots track total level, total XP, boss kill count and clue scrolls, so the
gain columns follow whichever metric the Team view is showing. The **first**
observation of each day is kept and never overwritten - that is what makes
"gained today" mean anything; overwriting on each poll would leave the delta
permanently at zero. A metric absent from an older snapshot reads `new` rather
than a misleading zero. Only fresh reads anchor a day, so a cached
payload cannot backdate one. History is per-browser, so it starts from the day
that browser first opened the page and a teammate's phone has its own.

This sits behind a deliberately narrow interface (`snapshot` / `gains` in
`history.js`) so it can be replaced by [Wise Old Man](https://docs.wiseoldman.net/)'s
server-side group history - shared across everyone, with records and
competitions - without touching the views. That would be the natural next step,
proxied through the existing Worker with the API key server-side.

## Data source

Hiscores are fetched through a Cloudflare Worker
(`osrs-highscore-proxy.bensvatos.workers.dev`) because the hiscores endpoint
sends no CORS headers. The client adds an 8s timeout, one backoff retry, and a
24-hour `localStorage` last-known-good cache — a failed poll falls back to real
cached numbers with an "as of HH:MM" stamp rather than showing nothing.

## Code layout

```
index.html              entry point; no external dependencies
embed.html              slot-size preview and iCUE snippet builder
wwwroot/css/
  tokens.css            palette and radii; the accent lives here only
  base.css              reset, shell regions, scrollbars
  components.css        cards, gauges, buttons, tabs, picker, player menu
  views.css             milestone bar, Total grid, GIM panels
  layout.css            dual mode: [data-mode] and [data-bucket] rules
tools/
  sync-hiscore-data.mjs regenerates hiscore-data.js from a RuneLite checkout
wwwroot/js/
  hiscore-data.js       GENERATED: skill/activity/boss lists, sprite ids
  config.js             query-string options
  mode.js               layout bucket resolution (one ResizeObserver)
  constants.js          boss names, team roster, skill orders
  osrs.js               precomputed XP table, level and milestone maths
  format.js             number/rank/clock formatting, icon paths, colour ramp
  model.js              hiscores payload -> uniform display items
  history.js            daily localStorage snapshots -> XP gained
  api.js                fetch with timeout, retry and cache
  store.js              state plus batched, region-scoped render scheduling
  dom.js                small element helpers
  components.js         reusable UI pieces
  views/                item.js, total.js, gim.js, team.js
  app.js                shell, wiring and timers
wwwroot/icons/          skill and activity icons (PNG, named by slug)
```

### Adding a team member

Edit `TEAM` in `wwwroot/js/constants.js`. The player dropdown and the GIM layout
are both derived from it. `pos` places the member in the GIM view
(`tl`/`tr`/`bl`/`br`/`c`).

### Icons

Icon filenames are the display name lowercased with `:'()` stripped and spaces
replaced by hyphens — `Chambers of Xeric: Challenge Mode` becomes
`chambers-of-xeric-challenge-mode.png`.

The icon set is checked in by hand and Jagex adds bosses every few months, so a
missing file is expected rather than exceptional. Any name without one renders a
**monogram badge** instead — `Brutus` becomes `BR`, `Mad Angel` becomes `MA` —
which keeps the row readable and covers future additions automatically. To
replace a monogram with real art, drop a PNG at the slugged filename (about
32×32, transparent) and it is picked up with no code change:

```
wwwroot/icons/activities/brutus.png
wwwroot/icons/activities/mad-angel.png
```

### Hiscore classification is generated, not hand-kept

The hiscores return one flat `activities` array mixing bosses with minigames,
clue scrolls and points tables, and nothing in the payload says which is which.
That split used to be a hand-maintained list here, which meant every newly
released boss quietly appeared under Activities until somebody noticed — Brutus,
Mad Angel and Maggot King all did.

It now comes from [RuneLite](https://github.com/runelite/runelite)'s
`HiscoreSkill.java`, which keeps an authoritative typed list. To refresh after a
game update:

```sh
git clone --depth 1 https://github.com/runelite/runelite /tmp/runelite
node tools/sync-hiscore-data.mjs /tmp/runelite
```

That rewrites `wwwroot/js/hiscore-data.js` (generated — do not edit by hand)
with the skill, activity and boss lists, each entry's game sprite id, and which
entries have no icon file committed.

### Where the icons come from

All 112 hiscore icons are lossless PNGs imported from
[Wise Old Man](https://github.com/wise-old-man/wise-old-man)'s
`app/public/img/metrics/`, via `tools/import-icons.mjs`:

```sh
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/wise-old-man/wise-old-man /tmp/wom
git -C /tmp/wom sparse-checkout set app/public/img/metrics
node tools/import-icons.mjs /tmp/wom
```

WOM names its files after its own metric ids, which match the hiscore display
names once punctuation is stripped — except five, which the tool aliases
(`Runecraft`→`runecrafting`, `LMS - Rank`→`last_man_standing`,
`PvP Arena - Rank`→`pvp_arena`, `Rifts closed`→`guardians_of_the_rift`,
`Tombs of Amascut: Expert Mode`→`tombs_of_amascut_expert`).

**RuneLite is not a usable source for boss art.** Its hiscore panel calls
`spriteManager.getSpriteAsync(skill.getSpriteId(), …)` and reads each icon out
of the running game client's sprite cache by numeric id, so the repository ships
no boss images at all — only the 24 skill icons and some account-type badges.
For the 25 icons both projects carry, 23 are pixel-identical and the other two
differ by at most 11/255, so WOM is used throughout for a single provenance.

The sprite ids in `hiscore-data.js` remain a lookup for anyone extracting art
from a game cache directly.

**The sprites are cropped to their content, not padded** — they range from
16×20 to 29×27. Every icon rule fixes both width and height for layout, so they
all carry `object-fit: contain`; without it Thieving (25×13) skews 48% in a
28×28 box.

### Adding a team member

Edit `TEAM` in `wwwroot/js/constants.js`. The player dropdown and the GIM layout
are both derived from it. `pos` places the member in the GIM view
(`tl`/`tr`/`bl`/`br`/`c`).

### Icons

Icon filenames are the display name lowercased with `:'()` stripped and spaces
replaced by hyphens — `Chambers of Xeric: Challenge Mode` becomes
`chambers-of-xeric-challenge-mode.png`.

The icon set is checked in by hand and Jagex adds bosses every few months, so a
missing file is expected rather than exceptional. Any name without one renders a
**monogram badge** instead — `Brutus` becomes `BR`, `Mad Angel` becomes `MA` —
which keeps the row readable and covers future additions automatically. To
replace a monogram with real art, drop a PNG at the slugged filename (about
32×32, transparent) and it is picked up with no code change:

```
wwwroot/icons/activities/brutus.png
wwwroot/icons/activities/mad-angel.png
```

### Hiscore classification is generated, not hand-kept

The hiscores return one flat `activities` array mixing bosses with minigames,
clue scrolls and points tables, and nothing in the payload says which is which.
That split used to be a hand-maintained list here, which meant every newly
released boss quietly appeared under Activities until somebody noticed — Brutus,
Mad Angel and Maggot King all did.

It now comes from [RuneLite](https://github.com/runelite/runelite)'s
`HiscoreSkill.java`, which keeps an authoritative typed list. To refresh after a
game update:

```sh
git clone --depth 1 https://github.com/runelite/runelite /tmp/runelite
node tools/sync-hiscore-data.mjs /tmp/runelite
```

That rewrites `wwwroot/js/hiscore-data.js` (generated — do not edit by hand)
with the skill, activity and boss lists, each entry's game sprite id, and which
entries have no icon file committed.

### Where the icons come from

The **skill** icons come from
[RuneLite's `skill_icons/`](https://github.com/runelite/runelite/tree/master/runelite-client/src/main/resources/skill_icons),
as lossless 25×25 PNGs.

RuneLite is **not** a source for boss art. Its hiscore panel calls
`spriteManager.getSpriteAsync(skill.getSpriteId(), …)` and reads each icon from
the running game client's sprite cache by numeric id — the repository contains
no boss images at all, only account-type badges.

So the boss and activity icons here are still lossy WebP files carrying a
`.png` extension (82 of 89). That matters more than it sounds for 25×25 pixel
art: VP8 lossy uses 4:2:0 chroma subsampling, which bleeds colour into flat
regions and desaturates them. Measured against the lossless originals the skill
icons were off by a mean of 5–46 per channel, peaking at 212/255 on `magic`, so
the boss set is presumably similar. Replacing them needs a lossless source —
the sprite ids in `hiscore-data.js` cover all 71 bosses and are the practical
lead.

The three with no file at all:

| Boss | Sprite id |
|---|---|
| Brutus | 6352 |
| Maggot King | 8358 |
| Mad Angel | 8359 |

Until a file exists, those render as monograms and the app does not request the
missing path at all.
