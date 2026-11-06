import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { addCalendarMonths, formatCalendarDate, getOpeningPeriod } from '../product-period.js';

test('opening period uses the calendar anniversary and describes it without a lot expiry claim', () => {
  assert.deepEqual(getOpeningPeriod('2026-11-06', 12), {
    date: '2027-11-06', formattedDate: '2027.11.06', label: '개봉 후 12개월 도달일 2027.11.06',
  });
  assert.equal(formatCalendarDate('2024-02-29'), '2024.02.29');
});

test('month-end and leap-day dates clamp to the end of the destination month', () => {
  assert.equal(addCalendarMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(addCalendarMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addCalendarMonths('2023-01-31', 1), '2023-02-28');
  assert.equal(addCalendarMonths('2024-03-31', 1), '2024-04-30');
  assert.equal(addCalendarMonths('2099-02-28', 12), '2100-02-28');
  assert.equal(addCalendarMonths('1999-02-28', 12), '2000-02-28');
});

test('missing, invalid and out-of-range dates or periods produce no anniversary', () => {
  for (const value of ['', null, undefined, '2023-02-29', '2026-13-01', '2026-00-01', '2026-01-32', '2026-1-01', '0000-01-01']) {
    assert.equal(getOpeningPeriod(value, 12), null);
    assert.equal(formatCalendarDate(value), null);
  }
  for (const months of [0, -1, 1.5, '12', null, undefined, Number.MAX_SAFE_INTEGER]) {
    assert.equal(addCalendarMonths('2026-11-06', months), null);
  }
  assert.equal(addCalendarMonths('9999-12-31', 1), null);
});

test('opening-period dates remain unchanged across time zones', () => {
  const source = "import {getOpeningPeriod} from './product-period.js'; process.stdout.write(JSON.stringify(getOpeningPeriod('2024-02-29',12)));";
  const results = ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Seoul'].map(tz =>
    execFileSync(process.execPath, ['--input-type=module', '-e', source], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: tz }, encoding: 'utf8' })
  );
  assert.equal(new Set(results).size, 1);
  assert.equal(JSON.parse(results[0]).date, '2025-02-28');
});
