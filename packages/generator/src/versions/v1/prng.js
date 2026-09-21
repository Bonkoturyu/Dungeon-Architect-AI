export function createPrng(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError("seed must be a non-negative safe integer");
  }

  let state = (seed >>> 0) || 0x6d2b79f5;

  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(prng, length) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError("length must be a positive integer");
  }
  return Math.floor(prng() * length);
}
