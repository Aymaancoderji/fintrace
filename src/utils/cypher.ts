/**
 * Builds a Cypher variable-length relationship range (`*min..max`).
 *
 * Cypher cannot parameterize these bounds, so they must be interpolated into the
 * query string. That makes them the one injection surface in our Cypher, so this
 * helper is the single place allowed to produce the fragment: it coerces both
 * bounds to non-negative integers and rejects anything else, meaning callers
 * inherit the safety structurally instead of by convention.
 */
export function hopRange(min: number, max: number): string {
  const lo = Math.trunc(min);
  const hi = Math.trunc(max);

  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo < 1 || hi < lo) {
    throw new RangeError(`Invalid Cypher hop range: *${min}..${max}`);
  }

  return `*${lo}..${hi}`;
}
