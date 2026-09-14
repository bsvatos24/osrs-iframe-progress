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

export function img(src, alt, className) {
  const node = document.createElement("img");
  node.className = className || "";
  node.src = src;
  node.alt = alt || "";
  // Jagex adds bosses every few months; without this a name with no icon file
  // yet renders as a broken-image glyph.
  node.addEventListener("error", function () { node.classList.add("iconMissing"); }, { once: true });
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
