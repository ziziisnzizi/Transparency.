# Product images

Product imagery is matched by product slug, so the homepage and routine-ordered
catalog always use the same product and texture pair.

| Product | Primary image | Hover texture | Supplied primary SVG |
| --- | --- | --- | --- |
| Serum S.1 | `public/images/products/serum-s1.webp` | `public/images/textures/serum-s1.webp` | `세럼 S.1.svg` |
| Toner T.1 | `public/images/products/toner-t1.webp` | `public/images/textures/toner-t1.webp` | `toner-t1-curved-print-v2 1.svg` |
| Cream C.1 | `public/images/products/cream-c1.webp` | `public/images/textures/cream-c1.webp` | `크림 C.1.svg` |

The supplied SVGs contain embedded PNG photographs. Primary images were rendered
from the full SVG canvas to preserve its framing and print details, then encoded
as WebP at quality 90 with full alpha quality. The texture SVGs each contain one
1536 × 1024 PNG, encoded as WebP at quality 88 with full alpha quality. Original
dimensions and transparent backgrounds are preserved. The six web assets total
801,258 bytes, compared with 12,498,816 bytes for the supplied SVGs.

The shared product visual is used on home cards, catalog cards, detail pages,
and registered products. Fine-pointer hover crossfades to the texture; moving
away restores the primary image. Keyboard focus on product buttons exposes the
same texture. Touch users can open product details directly. Reduced-motion
settings disable the fade animation. Product-specific URLs and QR assets remain
independent of the imagery.
