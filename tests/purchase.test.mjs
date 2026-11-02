import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculatePurchaseTotals,
  formatPurchasePrice,
  validatePurchaseDetails,
} from '../purchase.js';

const pricing = Object.freeze({ shippingFee: 3000, freeShippingThreshold: 50000 });
const validDetails = Object.freeze({
  name: '테스트 사용자',
  phone: '010-1234-5678',
  postcode: '04524',
  address: '서울특별시 중구 세종대로 110',
  addressDetail: '',
  email: '',
  deliveryNote: '',
});

test('the three proposed product prices produce the correct one-item purchase totals', () => {
  for (const [product, price, expectedTotal] of [
    ['토너 T.1', 18000, 21000],
    ['세럼 S.1', 24000, 27000],
    ['크림 C.1', 26000, 29000],
  ]) {
    const totals = calculatePurchaseTotals(price, 1, pricing);
    assert.equal(totals.quantity, 1, product);
    assert.equal(totals.unitPrice, price, product);
    assert.equal(totals.subtotal, price, product);
    assert.equal(totals.shippingFee, 3000, product);
    assert.equal(totals.total, expectedTotal, product);
  }
});

test('free shipping starts at a 50,000 won product subtotal, including exact equality', () => {
  assert.equal(calculatePurchaseTotals(49999, 1, pricing).shippingFee, 3000);
  assert.equal(calculatePurchaseTotals(49999, 1, pricing).total, 52999);
  assert.equal(calculatePurchaseTotals(25000, 2, pricing).shippingFee, 0);
  assert.equal(calculatePurchaseTotals(25000, 2, pricing).total, 50000);
  assert.equal(calculatePurchaseTotals(26000, 2, pricing).shippingFee, 0);
  assert.equal(calculatePurchaseTotals(26000, 2, pricing).total, 52000);
  assert.equal(calculatePurchaseTotals(24000, 2, pricing).total, 51000);
});

test('quantity limits prevent zero, negative, fractional, or excessive item counts', () => {
  for (const quantity of [0, -1, '', null, undefined, NaN, Infinity]) {
    const totals = calculatePurchaseTotals(18000, quantity, pricing);
    assert.equal(totals.quantity, 1);
    assert.equal(totals.total, 21000);
  }
  assert.equal(calculatePurchaseTotals(18000, 2.8, pricing).quantity, 2);
  assert.equal(calculatePurchaseTotals(18000, 2.8, pricing).subtotal, 36000);
  for (const quantity of [99, 100, 1000000]) {
    const totals = calculatePurchaseTotals(18000, quantity, pricing);
    assert.equal(totals.quantity, 99);
    assert.equal(totals.subtotal, 1782000);
    assert.equal(totals.total, 1782000);
  }
});

test('missing product or delivery prices remain unknown rather than displaying a free purchase', () => {
  const missingPrice = calculatePurchaseTotals(null, 1, pricing);
  assert.equal(missingPrice.unitPrice, null);
  assert.equal(missingPrice.subtotal, null);
  assert.equal(missingPrice.shippingFee, null);
  assert.equal(missingPrice.total, null);

  const missingShipping = calculatePurchaseTotals(18000, 1, { shippingFee: null, freeShippingThreshold: 50000 });
  assert.equal(missingShipping.subtotal, 18000);
  assert.equal(missingShipping.shippingFee, null);
  assert.equal(missingShipping.total, null);

  const notConfigured = calculatePurchaseTotals(18000, 1);
  assert.equal(notConfigured.subtotal, 18000);
  assert.equal(notConfigured.shippingFee, null);
  assert.equal(notConfigured.total, null);
});

test('invalid money and overflowing arithmetic never produce unsafe payable totals', () => {
  for (const price of [-1, 0.5, NaN, Infinity, -Infinity, '18000', Number.MAX_SAFE_INTEGER + 1]) {
    const totals = calculatePurchaseTotals(price, 1, pricing);
    assert.equal(totals.unitPrice, null);
    assert.equal(totals.subtotal, null);
    assert.equal(totals.total, null);
  }
  const overflowingSubtotal = calculatePurchaseTotals(Number.MAX_SAFE_INTEGER, 2, pricing);
  assert.equal(overflowingSubtotal.subtotal, null);
  assert.equal(overflowingSubtotal.total, null);

  const overflowingTotal = calculatePurchaseTotals(18000, 1, { shippingFee: Number.MAX_SAFE_INTEGER });
  assert.equal(overflowingTotal.subtotal, 18000);
  assert.equal(overflowingTotal.total, null);
  assert.equal(calculatePurchaseTotals(0, 1, { shippingFee: 0 }).total, 0);
});

test('KRW formatting distinguishes a known zero price from an unannounced amount', () => {
  assert.equal(formatPurchasePrice(18000), '18,000원');
  assert.equal(formatPurchasePrice(0), '0원');
  for (const amount of [null, undefined, NaN, -1, Infinity, 18.5, '18000']) {
    assert.equal(formatPurchasePrice(amount), '가격 안내 예정');
  }
  assert.equal(formatPurchasePrice(null, '배송비 안내 예정'), '배송비 안내 예정');
});

test('valid Korean delivery details are accepted with empty optional fields and whitespace', () => {
  assert.deepEqual(validatePurchaseDetails(validDetails), {});
  assert.deepEqual(validatePurchaseDetails({
    ...validDetails,
    name: '  테스트 사용자  ',
    phone: '  02-123-4567  ',
    postcode: '  04524  ',
    email: ' buyer@example.com ',
    addressDetail: '테스트동 101호',
    deliveryNote: '문 앞에 놓아 주세요.',
  }), {});
});

test('missing or malformed required delivery fields return the matching field errors', () => {
  for (const value of [undefined, null, {}]) {
    assert.deepEqual(Object.keys(validatePurchaseDetails(value)).sort(), ['address', 'name', 'phone', 'postcode']);
  }
  const invalidFields = {
    name: ['', '   ', '가'.repeat(51)],
    phone: ['', '12345', 'abc', '010-123-45', '010123456789'],
    postcode: ['', '1234', '123456', 'abcde'],
    address: ['', '1234', '가'.repeat(201)],
  };
  for (const [field, values] of Object.entries(invalidFields)) {
    for (const value of values) {
      const errors = validatePurchaseDetails({ ...validDetails, [field]: value });
      assert.deepEqual(Object.keys(errors), [field], `${field}: ${JSON.stringify(value)}`);
      assert.equal(typeof errors[field], 'string');
      assert.ok(errors[field].length > 0);
    }
  }
});

test('optional delivery fields enforce useful format and length limits when supplied', () => {
  assert.deepEqual(validatePurchaseDetails({
    ...validDetails,
    name: '가'.repeat(50),
    address: '가'.repeat(200),
    addressDetail: '가'.repeat(100),
    deliveryNote: '가'.repeat(200),
  }), {});
  for (const email of ['not-an-email', 'buyer@', '@example.com', 'buyer @example.com', `${'a'.repeat(250)}@example.com`]) {
    assert.deepEqual(Object.keys(validatePurchaseDetails({ ...validDetails, email })), ['email']);
  }
  assert.deepEqual(Object.keys(validatePurchaseDetails({ ...validDetails, addressDetail: '가'.repeat(101) })), ['addressDetail']);
  assert.deepEqual(Object.keys(validatePurchaseDetails({ ...validDetails, deliveryNote: '가'.repeat(201) })), ['deliveryNote']);
});

test('amount and delivery validation helpers are pure and do not access browser storage or network', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const draft = Object.freeze({ ...validDetails, email: 'buyer@example.com' });
  const before = JSON.stringify(draft);
  let sideEffects = 0;
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { sideEffects += 1; throw new Error('Storage access forbidden'); } });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value() { sideEffects += 1; throw new Error('Network access forbidden'); } });
    assert.deepEqual(validatePurchaseDetails(draft), {});
    assert.equal(calculatePurchaseTotals(26000, 2, pricing).total, 52000);
    assert.equal(formatPurchasePrice(52000), '52,000원');
    assert.equal(sideEffects, 0);
    assert.equal(JSON.stringify(draft), before);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
    else delete globalThis.fetch;
  }
});
