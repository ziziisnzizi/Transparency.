const routineOrder = { toner: 1, serum: 2, cream: 3 };

// Products follow the skincare routine. Ratings belong to individual reviews.
// Multiple formulas in the same family (T.1, T.2, ...) stay together.
export function orderProductsByRoutine(products) {
  return [...products].sort((a, b) =>
    (routineOrder[a.kind] ?? Number.MAX_SAFE_INTEGER) - (routineOrder[b.kind] ?? Number.MAX_SAFE_INTEGER)
    || a.name.localeCompare(b.name, 'ko-KR', { numeric: true, sensitivity: 'base' })
  );
}
