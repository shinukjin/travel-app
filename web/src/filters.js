export function typeIds(source) {
  return Array.isArray(source) ? source.map((item) => item.id || item) : Object.keys(source);
}

export function showingAll(visible, all) {
  return !visible?.length || all.every((id) => visible.includes(id));
}

export function isShown(visible, id, all) {
  return showingAll(visible, all) || visible.includes(id);
}

export function toggleVisible(visible, id, all) {
  if (showingAll(visible, all)) return [id];
  if (visible.includes(id)) {
    const next = visible.filter((item) => item !== id);
    return next.length ? next : [...all];
  }
  return [...visible, id];
}
