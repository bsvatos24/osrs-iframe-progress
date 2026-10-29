// ============================================================
// Entry point. Two separate apps share one deploy:
//
//   kiosk.js  the ambient display for the XENEON EDGE iframe widget: one
//             screen, no scrolling, auto-cycling, touch-sized controls
//   web.js    the site the group opens in a browser: top navigation, scrolling
//             pages, light and dark themes
//
// The inline script in index.html's <head> has already decided which one this
// is (data-mode) and loaded that mode's stylesheets, so each app only ever
// downloads its own code.
// ============================================================

const mode = document.documentElement.dataset.mode === "kiosk" ? "kiosk" : "web";
const app = await import(mode === "kiosk" ? "./kiosk.js" : "./web.js");
app.start();