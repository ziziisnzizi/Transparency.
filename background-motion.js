// Deterministic fluid memory. Inputs are normalized movement only; no clocks,
// browser APIs, storage, randomness or mutation of the caller's objects.
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = value => Math.atan2(Math.sin(value), Math.cos(value));

export const BACKGROUND_MOTION_LIMITS = Object.freeze({ x: .55, y: .55, spin: 1.1, phase: Math.PI });
export function createBackgroundMotion() { return { x: 0, y: 0, spin: 0, phase: 0 }; }

export function stepBackgroundMotion(state = {}, input = {}, seconds = 0, options = {}) {
  state = state && typeof state === 'object' ? state : {};
  input = input && typeof input === 'object' ? input : {};
  options = options && typeof options === 'object' ? options : {};
  const dt = Math.max(0, finite(seconds));
  const gain = clamp(finite(options.memoryGain, .85), 0, 3);
  const decay = clamp(finite(options.memoryRelaxation, .045), 0, 2);
  const spinDecay = clamp(finite(options.memorySpinRelaxation, .030), 0, 2);
  const phaseDecay = clamp(finite(options.memoryPhaseRelaxation, .015), 0, 2);
  let x = clamp(finite(state.x), -.55, .55) * Math.exp(-decay * dt);
  let y = clamp(finite(state.y), -.55, .55) * Math.exp(-decay * dt);
  let spin = clamp(finite(state.spin), -1.1, 1.1) * Math.exp(-spinDecay * dt);
  let phase = wrap(finite(state.phase)) * Math.exp(-phaseDecay * dt);
  const activity = input.active === true ? 1 : clamp(finite(input.active), 0, 1);
  if (dt > 0 && activity > 0) {
    const px = clamp(finite(input.x), -1, 1), py = clamp(finite(input.y), -1, 1);
    const dx = clamp(finite(input.dx), -2, 2) * activity;
    const dy = clamp(finite(input.dy), -2, 2) * activity;
    const distance = Math.hypot(dx, dy);
    // Weighted advection and signed circulation retain path order, even for a
    // closed loop whose final cursor position equals its starting position.
    const circulation = px * dy - py * dx;
    x += gain * (dx * (.50 + .35 * Math.abs(py)) - dy * px * .18);
    y += gain * (dy * (.50 + .35 * Math.abs(px)) + dx * py * .18);
    spin += circulation * gain * .80;
    phase += (distance * .48 + circulation * .22) * gain;
  }
  return { x: clamp(x, -.55, .55), y: clamp(y, -.55, .55), spin: clamp(spin, -1.1, 1.1), phase: wrap(phase) };
}
