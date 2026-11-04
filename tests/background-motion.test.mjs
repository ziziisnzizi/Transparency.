import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackgroundMotion, stepBackgroundMotion, BACKGROUND_MOTION_LIMITS } from '../background-motion.js';

const stationary = Object.freeze({ x: 0, y: 0, dx: 0, dy: 0, active: 1 });
const magnitude = state => Object.values(state).reduce((sum, value) => sum + Math.abs(value), 0);
function assertBounded(state) {
  assert.deepEqual(Object.keys(state).sort(), Object.keys(BACKGROUND_MOTION_LIMITS).sort());
  for (const [key, limit] of Object.entries(BACKGROUND_MOTION_LIMITS)) {
    assert.ok(Number.isFinite(state[key]), `${key} must stay finite`);
    assert.ok(Math.abs(state[key]) <= limit + 1e-12, `${key} exceeded its public bound`);
  }
}
function closedPath(direction) {
  let state = createBackgroundMotion(), previous = { x: 0, y: 0 };
  function advance(x, y) {
    state = stepBackgroundMotion(state, { x, y, dx: x - previous.x, dy: y - previous.y, active: 1 }, 1 / 60);
    previous = { x, y };
  }
  advance(.68, 0);
  for (let i = 1; i <= 120; i++) {
    const angle = direction * i / 120 * Math.PI * 2;
    advance(.68 * Math.cos(angle), .52 * Math.sin(angle));
  }
  advance(0, 0);
  for (let i = 0; i < 12; i++) advance(0, 0);
  return state;
}

test('fluid memory stepping leaves caller state, input and options unchanged', () => {
  const state = Object.freeze(createBackgroundMotion());
  const input = Object.freeze({ x: .5, y: -.25, dx: .5, dy: -.25, active: 1 });
  const options = Object.freeze({ memoryGain: .85 });
  const next = stepBackgroundMotion(state, input, 1 / 30, options);
  assert.notStrictEqual(next, state);
  assert.deepEqual(state, { x: 0, y: 0, spin: 0, phase: 0 });
  assert.deepEqual(input, { x: .5, y: -.25, dx: .5, dy: -.25, active: 1 });
  assert.deepEqual(options, { memoryGain: .85 });
  assertBounded(next);
});

test('closed movement paths retain memory and reversing their order changes it', () => {
  const forward = closedPath(1), reverse = closedPath(-1);
  assertBounded(forward); assertBounded(reverse);
  assert.ok(magnitude(forward) > .1);
  assert.ok(magnitude(reverse) > .1);
  assert.ok(forward.spin * reverse.spin < 0, 'opposite circulation must survive the shared final point');
  assert.ok(Math.abs(forward.spin - reverse.spin) > .1);
  assert.notDeepEqual(forward, reverse);
});

test('the same path and step durations replay exactly without randomness', () => {
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('Path memory must not read randomness'); };
    assert.deepEqual(closedPath(1), closedPath(1));
    assert.deepEqual(closedPath(-1), closedPath(-1));
  } finally { Math.random = random; }
});

test('long movement sessions keep a fixed bounded state even after many turns', () => {
  let state = createBackgroundMotion(), x = 0, y = 0;
  for (let i = 0; i < 12000; i++) {
    const nextX = Math.sin(i * .21), nextY = Math.cos(i * .17);
    state = stepBackgroundMotion(state, { x: nextX, y: nextY, dx: nextX - x, dy: nextY - y, active: 1 }, 1 / 30);
    assertBounded(state); x = nextX; y = nextY;
  }
  assertBounded(stepBackgroundMotion({ x: Infinity, y: NaN, spin: -Infinity, phase: NaN }, { x: NaN, y: Infinity, dx: Infinity, dy: NaN, active: 1 }, Infinity));
});

test('a resting pointer keeps recent memory before it gradually relaxes', () => {
  const initial = closedPath(1), before = magnitude(initial);
  let state = initial;
  for (let i = 0; i < 60; i++) state = stepBackgroundMotion(state, stationary, 1 / 30);
  assert.ok(magnitude(state) > before * .8, 'stopping must not immediately reset the path');
  for (let i = 0; i < 3600; i++) state = stepBackgroundMotion(state, stationary, 1 / 30);
  assert.ok(magnitude(state) < before * .25, 'old movement should slowly relax');
  assertBounded(state);
});

test('stationary relaxation depends on elapsed time rather than frame count', () => {
  const initial = closedPath(1);
  const coarse = stepBackgroundMotion(initial, stationary, 30);
  let fine = initial;
  for (let i = 0; i < 900; i++) fine = stepBackgroundMotion(fine, stationary, 1 / 30);
  for (const key of Object.keys(BACKGROUND_MOTION_LIMITS)) assert.ok(Math.abs(coarse[key] - fine[key]) < 1e-10, `${key} changed with frame cadence`);
});
