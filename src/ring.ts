// Spinning arc around the clock. It never stops while running: a steady rotation, with the
// head running ahead and the tail catching up each cycle, so the arc stretches and shrinks.
// Pausing brakes smoothly, resetting rewinds. requestAnimationFrame only runs while moving.

const CIRCUMFERENCE = 2 * Math.PI * 90;
const SPEED = 360 / 3000; // steady rotation, degrees per ms
const SPIN_UP_MS = 600; // play ramps up to SPEED instead of jumping to it
const CYCLE_MS = 2000; // one stretch-and-shrink of the arc
const BRAKE_MS = 1100;
const REWIND_MS = 950;
const ARC_MIN = 0.1;
const ARC_MAX = 0.42;
const GROW = (ARC_MAX - ARC_MIN) * 360; // degrees the head and the tail each advance per cycle

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Motion =
  | { kind: "idle" }
  | { kind: "spin"; start: number; base: number }
  | { kind: "tween"; start: number; duration: number; fromAngle: number; toAngle: number; fromArc: number; toArc: number; ease: (t: number) => number; then?: () => void };

export class Ring {
  private angle = 0;
  private arc = ARC_MIN;
  private velocity = 0; // degrees per ms, measured from the last two frames
  private lastFrame = 0;
  private motion: Motion = { kind: "idle" };
  private frame = 0;

  constructor(private spin: SVGGElement, private arcEl: SVGCircleElement) {
    this.draw();
  }

  play(): void {
    this.motion = { kind: "spin", start: performance.now(), base: this.angle };
    this.loop();
  }

  // Brake with the velocity the arc currently has, so it glides to a stop.
  pause(): void {
    const velocity = this.motion.kind === "spin" ? Math.max(this.velocity, 0) : 0;
    // easeOutCubic starts with slope 3, so distance = v * duration / 3 keeps the speed continuous.
    this.tween(this.angle + (velocity * BRAKE_MS) / 3, ARC_MIN, BRAKE_MS, easeOutCubic);
  }

  // Spin backwards one lap plus the remainder, landing at the top.
  rewind(then?: () => void): void {
    const target = this.angle - (((this.angle % 360) + 360) % 360) - 360;
    this.tween(target, ARC_MIN, REWIND_MS, easeInOutQuint, then);
  }

  private tween(toAngle: number, toArc: number, duration: number, ease: (t: number) => number, then?: () => void): void {
    this.motion = { kind: "tween", start: performance.now(), duration, fromAngle: this.angle, toAngle, fromArc: this.arc, toArc, ease, then };
    this.loop();
  }

  private loop(): void {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    const m = this.motion;

    const prevAngle = this.angle;

    if (m.kind === "spin") {
      const elapsed = Math.max(now - m.start, 0);
      // Velocity ramps linearly over SPIN_UP_MS, then holds at SPEED.
      const rotation = elapsed < SPIN_UP_MS ? (SPEED * elapsed ** 2) / (2 * SPIN_UP_MS) : SPEED * (elapsed - SPIN_UP_MS / 2);
      const cycle = elapsed / CYCLE_MS;
      const done = Math.floor(cycle) * GROW;
      const t = cycle % 1;
      // The head moves in the first 55% of the cycle, the tail in the last 55%; they overlap mid-cycle.
      const head = done + easeInOutCubic(clamp01(t / 0.55)) * GROW;
      const tail = done + easeInOutCubic(clamp01((t - 0.45) / 0.55)) * GROW;
      this.angle = m.base + rotation + head;
      this.arc = ARC_MIN + (head - tail) / 360;
    } else if (m.kind === "tween") {
      const t = clamp01((now - m.start) / m.duration);
      const e = m.ease(t);
      this.angle = lerp(m.fromAngle, m.toAngle, e);
      this.arc = lerp(m.fromArc, m.toArc, e);
      if (t === 1) {
        this.angle = ((this.angle % 360) + 360) % 360;
        this.motion = { kind: "idle" };
        m.then?.();
      }
    }

    if (this.lastFrame && now > this.lastFrame) this.velocity = (this.angle - prevAngle) / (now - this.lastFrame);
    this.lastFrame = this.motion.kind === "idle" ? 0 : now;

    this.draw();
    if (this.motion.kind !== "idle") this.loop();
  };

  private draw(): void {
    const len = this.arc * CIRCUMFERENCE;
    this.arcEl.style.strokeDasharray = `${len} ${CIRCUMFERENCE}`;
    // The arc's head leads: rotate so the arc ends at the current angle, starting from 12 o'clock.
    this.spin.style.transform = `rotate(${this.angle - 90 - this.arc * 360}deg)`;
  }
}
