// Spinning arc around the clock. Each lap eases in and out; pausing brakes smoothly,
// resetting rewinds. requestAnimationFrame only runs while something is moving.

const CIRCUMFERENCE = 2 * Math.PI * 90;
const LAP_MS = 2400;
const BRAKE_MS = 1100;
const REWIND_MS = 950;
const ARC_REST = 0.12;
const ARC_MIN = 0.1;
const ARC_MAX = 0.42;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeInOutCubicSlope = (t: number) => (t < 0.5 ? 12 * t ** 2 : 3 * (-2 * t + 2) ** 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Motion =
  | { kind: "idle" }
  | { kind: "spin"; lapStart: number; lapBase: number }
  | { kind: "tween"; start: number; duration: number; fromAngle: number; toAngle: number; fromArc: number; toArc: number; ease: (t: number) => number; then?: () => void };

export class Ring {
  private angle = 0;
  private arc = ARC_REST;
  private motion: Motion = { kind: "idle" };
  private frame = 0;

  constructor(private spin: SVGGElement, private arcEl: SVGCircleElement) {
    this.draw();
  }

  play(): void {
    this.motion = { kind: "spin", lapStart: performance.now(), lapBase: this.angle };
    this.loop();
  }

  // Brake with the velocity the arc currently has, so it glides to a stop.
  pause(): void {
    const now = performance.now();
    let velocity = 0; // degrees per ms
    if (this.motion.kind === "spin") {
      const t = Math.min((now - this.motion.lapStart) / LAP_MS, 1);
      velocity = (easeInOutCubicSlope(t) * 360) / LAP_MS;
    }
    // easeOutCubic starts with slope 3, so distance = v * duration / 3 keeps the speed continuous.
    this.tween(this.angle + (velocity * BRAKE_MS) / 3, ARC_REST, BRAKE_MS, easeOutCubic);
  }

  // Spin backwards one lap plus the remainder, landing at the top.
  rewind(then?: () => void): void {
    const target = this.angle - (((this.angle % 360) + 360) % 360) - 360;
    this.tween(target, ARC_REST, REWIND_MS, easeInOutQuint, then);
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

    if (m.kind === "spin") {
      let t = (now - m.lapStart) / LAP_MS;
      while (t >= 1) {
        m.lapStart += LAP_MS;
        m.lapBase += 360;
        t -= 1;
      }
      this.angle = m.lapBase + easeInOutCubic(t) * 360;
      this.arc = lerp(ARC_MIN, ARC_MAX, Math.sin(Math.PI * t));
    } else if (m.kind === "tween") {
      const t = Math.min((now - m.start) / m.duration, 1);
      const e = m.ease(t);
      this.angle = lerp(m.fromAngle, m.toAngle, e);
      this.arc = lerp(m.fromArc, m.toArc, e);
      if (t === 1) {
        this.angle = ((this.angle % 360) + 360) % 360;
        this.motion = { kind: "idle" };
        m.then?.();
      }
    }

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
