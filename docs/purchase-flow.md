# Purchase flow

The purchase view is available from each product detail's 구매하기 action and
the footer's 제품 구매 action. Its URL preserves the selected product:

- `/?view=buy&product=toner-t1`
- `/?view=buy&product=serum-s1`
- `/?view=buy&product=cream-c1`

## Proposed pricing

The user requested a middle-market position and asked for a price recommendation.
These are the proposed prices used by the interface, pending manufacturing and
packaging cost review; they are not a researched market-price comparison.

| Product | Volume | Price |
| --- | --- | --- |
| Toner T.1 | 150 mL | 18,000 KRW |
| Serum S.1 | 30 mL | 24,000 KRW |
| Cream C.1 | 50 mL | 26,000 KRW |

Shipping is 3,000 KRW and becomes free when the merchandise subtotal reaches
50,000 KRW. Prices live in the product records in `main.js`; the shipping policy
is its `purchasePricing` object. Quantities are limited to 1–99. Unknown prices
or shipping costs remain unknown rather than being calculated as zero.

## Behavior and data

`purchase.js` renders selection, quantity controls, delivery fields, the order
summary, and an order-details review/edit stage. `purchase.css` scopes its layout
and glass materials to `.purchase-page`. Product details, review behavior, and
product QR links remain available through their existing routes.

The shipping draft and quantities exist in module memory so a theme change or
edit transition preserves them. Recipient details are not written to browser
storage, sent to a server, or included in the URL. Refreshing discards that draft.

Payment processing and order reception are not connected. The final review
stage explains this and disables payment. It does not collect card details,
create order identifiers, claim a successful purchase, or dispatch an order.

## Brand and review presentation

Header, footer, hero, and brand introduction use the text wordmark
`Transparency.` with its final period. The provided product photography and
favicon remain in use.

Prepared review cards use the same visual layout as written reviews without
an individual source badge. A visible note before the combined list states that
prepared content is not actual purchase testimony. Total review counts include
both prepared and directly written entries with a visible breakdown. Average
ratings use those same entries, so prepared reviews also contribute before a
visitor writes a review.
