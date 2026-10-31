// ============================================================
// Building blocks shared by the web pages. DOM only - every number comes in
// already worked out by the page that uses it.
// ============================================================

import { el, img } from "../dom.js";

// URL-safe player id for hash routes: "Z o i n k z" -> "z-o-i-n-k-z".
export function playerSlug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function playerHref(name) {
  return "#player-" + playerSlug(name);
}

export function link(href, className, text) {
  const node = el("a", className, text);
  node.href = href;
  return node;
}

export function icon(src, alt) {
  return img(src, alt, "ico");
}

export function pageHead(title, blurb, aside) {
  const head = el("div", "page-head");
  const text = el("div");
  text.appendChild(el("h1", null, title));
  if (blurb) text.appendChild(el("p", null, blurb));
  head.appendChild(text);
  if (aside) head.appendChild(aside);
  return head;
}

export function card(title, blurb, ...body) {
  const section = el("section", "card");
  const head = el("div", "card-head");
  head.appendChild(el("h2", null, title));
  if (blurb) head.appendChild(el("p", null, blurb));
  section.appendChild(head);
  body.filter(Boolean).forEach(function (node) { section.appendChild(node); });
  return section;
}

// A card with a control (a toggle) on the right of its heading.
export function toolCard(title, blurb, tool, ...body) {
  const section = card(title, blurb, ...body);
  const head = section.querySelector(".card-head");
  head.classList.add("tools");
  // Title and blurb stack on the left so the control lines up with both.
  const text = el("div");
  text.append(...head.childNodes);
  head.append(text, tool);
  return section;
}

// [{ label, value, note? }]
export function stats(items) {
  const strip = el("div", "stats");
  items.forEach(function (item) {
    const cell = el("div", "stat");
    cell.appendChild(el("span", "label", item.label));
    cell.appendChild(el("b", null, item.value));
    if (item.note) cell.appendChild(el("small", null, item.note));
    strip.appendChild(cell);
  });
  return strip;
}

export function meter(pct, className) {
  const track = el("div", "meter" + (className ? " " + className : ""));
  const fill = el("i");
  fill.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%";
  track.appendChild(fill);
  return track;
}

// A ranked list row: icon, two lines of text, a meter, and a value.
// { iconUrl, iconAlt, main, sub?, pct?, value }
export function listRow(row) {
  const node = el("div", "li");
  node.appendChild(icon(row.iconUrl, row.iconAlt));
  const text = el("div");
  text.style.minWidth = "0";
  text.appendChild(el("div", "main", row.main));
  if (row.sub) text.appendChild(el("div", "sub", row.sub));
  node.appendChild(text);
  // Rows with nothing to measure against (activity scores) keep the column.
  node.appendChild(row.pct == null ? el("div", "meter-gap") : meter(row.pct));
  node.appendChild(el("div", "val", row.value));
  return node;
}

// A list that shows `limit` rows and a button for the rest.
export function list(rows, limit, emptyText) {
  const wrap = el("div");
  const body = el("div", "list");
  wrap.appendChild(body);

  if (rows.length === 0) {
    body.appendChild(el("p", "empty", emptyText || "Nothing yet."));
    return wrap;
  }

  // A button that reveals one or two more rows is worse than just showing them.
  if (rows.length <= limit + 2) limit = rows.length;
  rows.slice(0, limit).forEach(function (row) { body.appendChild(listRow(row)); });
  if (rows.length > limit) {
    const more = el("button", "more", "Show all " + rows.length);
    more.type = "button";
    more.addEventListener("click", function () {
      rows.slice(limit).forEach(function (row) { body.appendChild(listRow(row)); });
      more.remove();
    });
    wrap.appendChild(more);
  }
  return wrap;
}

export function notice(text, bad) {
  return el("div", "notice" + (bad ? " bad" : ""), text);
}