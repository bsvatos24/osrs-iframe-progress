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
| Team | Standings ranked by total level, with XP gained today and over 7 days, plus an "about to level" board of the level-ups nearest across the whole team |

In kiosk mode the current category auto-cycles every 6 seconds; **Pin** freezes
it, the grid button opens a searchable picker, and the player dropdown switches
accounts. In web mode cycling is off by default so the view does not move while
you are reading it.

## Web pages

The browser version has its own layout (`web.js`), with hash routes so any page
can be bookmarked or sent:

| Route | Shows |
|---|---|
| `#overview` | Group totals, standings with XP gained today and over 7 days, **Training** (each player's XP gained and the skills it went into), About to level, Most killed |
| `#player-<name>` | One member: **Gaining XP** (XP per day for the last week, and every skill gained in with levels gained), skills with this week's gain on each tile, bosses, clues, activities |
| `#compare`, `#compare-bosses`, `#compare-activities` | Everyone side by side |
| `#compare-gains` | XP gained per skill per player, shaded by amount |
| `#activity` | Level-ups, 200M, and days with 25k+ XP in a skill, grouped by day, for the last week |

The gains views share one Today / 7 days switch, remembered per browser.

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

Open **`embed.html`** on the deployed site. It previews the dashboard at each
iCUE slot size (M 840x696, L 1688x696, XL 2536x696), lets you pick the view and
options, and emits the snippet to paste into the iCUE **IFRAME** widget:

```html
<iframe src="https://<your-pages-url>/index.html?view=gim&mode=kiosk&chrome=0"
        width="100%" height="100%" frameborder="0"></iframe>
```

`embed.html` is also the way to check all three slot layouts without swapping
the live widget.

### Updating the widget after a deploy

iCUE keeps the widget's files cached across a deploy. Bump `v=` in the iframe
URL (`v=3` to `v=4`) and every file the page loads is fetched fresh: `index.html`
stamps `?v=` on each stylesheet and, through an import map, on every module.
A new module has to be added to the list in `index.html` to get the stamp; one
left out still loads, just without it.

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
gained. Two sources fill that gap.

### Wise Old Man (web)

The web pages' gains come from [Wise Old Man](https://wiseoldman.net), which
stores a snapshot of a player every time they are updated, on its servers, so
everyone sees the same history on every device. `wom.js` fetches 14 days of
snapshots per player; `gains.js` measures from the snapshot at the start of the
window to the **live** hiscores read the page just made, so gains are current
even when Wise Old Man was last updated hours ago.

Wise Old Man only records a player when asked. The page asks: a player it has
never seen is tracked, and one whose newest snapshot is over 30 minutes old is
updated, both in the background. Its limits without an API key are 20
requests a minute and 500 an hour per IP, and one update per player per minute;
a load costs at most two requests per player and history is refetched at most
every 5 minutes however often Refresh is pressed.

Activity times are when a change was first seen, which can be later than when
it happened. A skill that is unranked at either end of a window is left out
rather than counted from zero.

### Browser snapshots (kiosk, and web fallback)

The app also stores one snapshot per player per day in `localStorage` and
diffs against it. That powers the kiosk Team view's "today" and "7 days"
columns, and the web Standings for a player Wise Old Man has nothing on.

The **first** observation of each day is kept and never overwritten - that is
what makes "gained today" mean anything; overwriting on each poll would leave
the delta permanently at zero. Only fresh reads anchor a day, so a cached
payload cannot backdate one. History is per-browser, so it starts from the day
that browser first opened the page and a teammate's phone has its own.

The kiosk could move to Wise Old Man the same way; it has not yet, so the
Edge makes no extra requests.

## Data source

Hiscores are fetched through a Cloudflare Worker
(`osrs-highscore-proxy.bensvatos.workers.dev`) because the hiscores endpoint
sends no CORS headers. The client adds an 8s timeout, one backoff retry, and a
24-hour `localStorage` last-known-good cache — a failed poll falls back to real
cached numbers with an "as of HH:MM" stamp rather than showing nothing.

## Code layout

```
index.html              entry point; picks kiosk or web, stamps ?v= on every file
embed.html              slot-size preview and iCUE snippet builder
wwwroot/css/
  tokens.css            palette and radii; the accent lives here only
  base.css              reset, shell regions, scrollbars
  components.css        cards, gauges, buttons, tabs, picker, player menu
  views.css             milestone bar, Total grid, GIM panels
  layout.css            dual mode: [data-mode] and [data-bucket] rules
  web.css               the web app's pages, light and dark
  treatments.css        99 / 200M styling, shared by both apps
wwwroot/js/
  config.js             query-string options
  mode.js               layout bucket resolution (one ResizeObserver)
  constants.js          boss names, team roster, skill orders
  osrs.js               precomputed XP table, level and milestone maths
  format.js             number/rank/clock formatting, icon paths, colour ramp
  model.js              hiscores payload -> uniform display items
  history.js            daily localStorage snapshots -> XP gained
  wom.js                Wise Old Man history: fetch, track and update players
  gains.js              XP gained per skill, per day, and activity events
  api.js                fetch with timeout, retry and cache
  store.js              state plus batched, region-scoped render scheduling
  dom.js                small element helpers
  components.js         reusable UI pieces
  views/                kiosk views: item.js, total.js, gim.js, team.js
  app.js                loads kiosk.js or web.js
  kiosk.js              kiosk shell, wiring and timers
  web.js                web shell: routes, polling, history loading
  web/                  web pages: overview, player, compare, training (gains), parts
wwwroot/icons/          skill and activity icons (PNG, named by slug)
```

### Adding a team member

Edit `TEAM` in `wwwroot/js/constants.js`. The player dropdown and the GIM layout
are both derived from it. `pos` places the member in the GIM view
(`tl`/`tr`/`bl`/`br`/`c`).

### Icons

Icon filenames are the display name lowercased with `:'()` stripped and spaces
replaced by hyphens — `Chambers of Xeric: Challenge Mode` becomes
`chambers-of-xeric-challenge-mode.png`. A name with no icon file yet renders
with the image hidden rather than as a broken-image glyph.