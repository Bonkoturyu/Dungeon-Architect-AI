export function createPrng(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('seed must be a non-negative safe integer');
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

export function randomInt(prng, min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError('randomInt bounds must be integers with min <= max');
  }
  return min + Math.floor(prng() * (max - min + 1));
}

export function shuffleInPlace(values, prng) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(prng() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}
