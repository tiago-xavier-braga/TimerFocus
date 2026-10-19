// Count-up stopwatch. Elapsed time is derived from timestamps, so it never drifts.
export class Stopwatch {
  private accumulated = 0;
  private startedAt: number | null = null;

  get running(): boolean {
    return this.startedAt !== null;
  }

  elapsed(now = Date.now()): number {
    return this.accumulated + (this.startedAt === null ? 0 : now - this.startedAt);
  }

  start(): void {
    if (this.startedAt === null) this.startedAt = Date.now();
  }

  pause(): void {
    if (this.startedAt === null) return;
    this.accumulated = this.elapsed();
    this.startedAt = null;
  }

  // Zeroes the display but keeps the running state.
  zero(): void {
    this.accumulated = 0;
    if (this.startedAt !== null) this.startedAt = Date.now();
  }
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// 5_400_000 -> "1h 30m", 300_000 -> "5m", 20_000 -> "20s"
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return m ? `${m}m` : `${total % 60}s`;
}

export const MS_PER_HOUR = 3_600_000;

// 5_400_000 -> 1.5, rounded to 2 decimals
export function toHours(ms: number): number {
  return Math.round((ms / MS_PER_HOUR) * 100) / 100;
}

// 5_400_000 -> "1.5h", 900_000 -> "0.25h"
export function formatHours(ms: number): string {
  return `${toHours(ms)}h`;
}
