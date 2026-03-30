/**
 * Replay protection for signaling messages.
 * Rejects duplicate messageIds, stale timestamps, and room mismatches.
 */

interface SeenEntry {
  timestamp: number;
  addedAt: number;
}

export class ReplayProtector {
  private seenIds: Map<string, SeenEntry>;
  private maxAgeMs: number;
  private maxClockSkewMs: number;

  constructor(maxAgeMs = 300_000, maxClockSkewMs = 30_000) {
    this.seenIds = new Map();
    this.maxAgeMs = maxAgeMs;
    this.maxClockSkewMs = maxClockSkewMs;
  }

  check(
    messageId: string,
    timestamp: number,
    roomId: string,
    expectedRoomId: string,
  ): { valid: boolean; reason?: string } {
    // Room mismatch -- possible misdirected or forged message
    if (roomId !== expectedRoomId) {
      return { valid: false, reason: 'Room ID mismatch' };
    }

    const now = Date.now();

    // Reject messages too far in the past
    if (now - timestamp > this.maxAgeMs) {
      return { valid: false, reason: 'Message timestamp too old' };
    }

    // Reject messages too far in the future (clock skew tolerance)
    if (timestamp - now > this.maxClockSkewMs) {
      return { valid: false, reason: 'Message timestamp too far in the future' };
    }

    // Duplicate detection
    if (this.seenIds.has(messageId)) {
      return { valid: false, reason: 'Duplicate message ID' };
    }

    // Record this message ID
    this.seenIds.set(messageId, { timestamp, addedAt: now });

    return { valid: true };
  }

  /** Remove entries older than maxAgeMs. Call periodically to bound memory. */
  cleanup(): void {
    const cutoff = Date.now() - this.maxAgeMs;
    for (const [id, entry] of this.seenIds) {
      if (entry.addedAt < cutoff) {
        this.seenIds.delete(id);
      }
    }
  }
}
