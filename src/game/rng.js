export function hashSeed(input) {
  const text = String(input ?? Date.now());
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed = Date.now()) {
  return {
    seed: String(seed),
    state: hashSeed(seed) || 0x9e3779b9
  };
}

export function randomFloat(rng) {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let value = rng.state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(rng, min, max) {
  return Math.floor(randomFloat(rng) * (max - min + 1)) + min;
}

export function chance(rng, probability) {
  return randomFloat(rng) < probability;
}

export function pick(rng, list) {
  if (!list.length) return undefined;
  return list[randomInt(rng, 0, list.length - 1)];
}

export function shuffle(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function weightedPick(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = randomFloat(rng) * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1]?.value;
}
