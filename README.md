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

The current category auto-cycles every 6 seconds. **Pin** freezes it, the grid
button opens a searchable picker, and the player dropdown switches accounts.

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

## Embedding on the XENEON EDGE

Add an **IFRAME** widget in iCUE and paste:

```html
<iframe src="https://<your-pages-url>/" width="100%" height="100%" frameborder="0"></iframe>
```

iCUE offers three iframe slot sizes, all 696px tall:

| Slot | Pixels | Share of screen |
|---|---|---|
| M | 840 x 696 | 1/3 |
| L | 1688 x 696 | 2/3 |
| XL | 2536 x 696 | full |

## Data source

Hiscores are fetched through a Cloudflare Worker
(`osrs-highscore-proxy.bensvatos.workers.dev`) because the hiscores endpoint
sends no CORS headers. The client adds an 8s timeout, one backoff retry, and a
24-hour `localStorage` last-known-good cache — a failed poll falls back to real
cached numbers with an "as of HH:MM" stamp rather than showing nothing.

## Code layout

```
index.html              entry point; no external dependencies
wwwroot/css/
  tokens.css            palette and radii; the accent lives here only
  base.css              reset, shell regions, scrollbars
  components.css        cards, gauges, buttons, tabs, picker, player menu
  views.css             milestone bar, Total grid, GIM panels
wwwroot/js/
  constants.js          boss names, team roster, skill orders
  osrs.js               precomputed XP table, level and milestone maths
  format.js             number/rank/clock formatting, icon paths, colour ramp
  model.js              hiscores payload -> uniform display items
  api.js                fetch with timeout, retry and cache
  store.js              state plus batched, region-scoped render scheduling
  dom.js                small element helpers
  components.js         reusable UI pieces
  views/                item.js, total.js, gim.js
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
`chambers-of-xeric-challenge-mode.png`. A name with no icon file yet renders
with the image hidden rather than as a broken-image glyph.
