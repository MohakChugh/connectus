/**
 * Safety number computation for peer identity verification.
 * Both peers derive the same number regardless of who is "local" vs "remote"
 * by sorting fingerprints lexicographically before hashing.
 */

const SEPARATOR = '||';
const NUM_GROUPS = 12;
const DIGITS_PER_GROUP = 5;
const MODULUS = 100_000; // 10^5, produces 5-digit groups (zero-padded)

/**
 * Compute a human-readable safety number from two peer fingerprints.
 * Output: 12 groups of 5 digits separated by spaces (60 digits total).
 */
export async function computeSafetyNumber(
  localFingerprint: string,
  remoteFingerprint: string,
): Promise<string> {
  // Canonical ordering so both peers produce the same result
  const [first, second] = [localFingerprint, remoteFingerprint].sort();

  const input = new TextEncoder().encode(`${first}${SEPARATOR}${second}`);
  const hash = await crypto.subtle.digest('SHA-256', input);
  const bytes = new Uint8Array(hash);

  const groups: string[] = [];

  for (let i = 0; i < NUM_GROUPS; i++) {
    // Use 4 bytes per group (big-endian) to derive a 5-digit number.
    // We cycle through the 32 hash bytes; 12 groups x 4 bytes = 48,
    // so we wrap around using modular indexing.
    const offset = (i * 4) % bytes.length;
    const value =
      ((bytes[offset] << 24) |
        (bytes[(offset + 1) % bytes.length] << 16) |
        (bytes[(offset + 2) % bytes.length] << 8) |
        bytes[(offset + 3) % bytes.length]) >>> 0; // unsigned

    groups.push(String(value % MODULUS).padStart(DIGITS_PER_GROUP, '0'));
  }

  return groups.join(' ');
}
