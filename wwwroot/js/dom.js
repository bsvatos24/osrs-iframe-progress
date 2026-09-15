// ============================================================
// Minimal DOM helpers.
// ============================================================

const SVG_NS = "http://www.w3.org/2000/svg";

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Up to two letters standing in for a missing icon: "Mad Angel" -> MA,
// "Brutus" -> BR.
export function initials(name) {
  const words = String(name || "").trim().split(/[\s:'-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function img(src, alt, className) {
  const node = document.createElement("img");
  node.className = className || "";
  node.src = src;
  node.alt = alt || "";

  // Jagex adds bosses every few months, and the icon set is checked in by
  // hand, so a name with no file yet is expected rather than exceptional.
  // Swap in a monogram badge that keeps the same class - and therefore the
  // same size - as the image it replaces.
  node.addEventListener("error", function () {
    const badge = document.createElement("span");
    badge.className = (className || "") + " iconFallback";
    badge.textContent = initials(alt);
    badge.title = alt || "";
    badge.setAttribute("aria-label", alt || "");
    if (node.parentNode) node.replaceWith(badge);
  }, { once: true });

  return node;
}

export function button(className, label, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  if (label != null) node.textContent = label;
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

export function svg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) {
    if (attrs[key] != null) node.setAttribute(key, attrs[key]);
  }
  return node;
}

export function svgText(x, y, className, content) {
  const node = svg("text", { x: x, y: y, "text-anchor": "middle", class: className });
  node.textContent = content;
  return node;
}

// Swap a region's contents in one operation. Replaces the old pattern of
// `container.innerHTML = ""` followed by a full rebuild of the whole app.
export function replaceChildren(container, ...nodes) {
  container.replaceChildren(...nodes.filter(Boolean));
  return container;
}
