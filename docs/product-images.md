# Product images

Product imagery is matched by product slug, so the homepage and routine-ordered
catalog always use the same product and texture pair.

| Product | Primary image | Texture image | Supplied primary file |
| --- | --- | --- | --- |
| Serum S.1 | `public/images/products/serum-s1.webp` | `public/images/textures/serum-s1.webp` | `serum_45(1).webp` |
| Toner T.1 | `public/images/products/toner-t1.webp` | `public/images/textures/toner-t1.webp` | `toner_editorial(1).webp` |
| Cream C.1 | `public/images/products/cream-c1.webp` | `public/images/textures/cream-c1.webp` | `cream_front(2).webp` |

Primary images were replaced on 2026-11-11 with the three supplied 1600 × 1600
WebP photographs, preserving the original bytes, framing, labels, QR codes, and
flower-and-grass backgrounds. Their combined size is 652,454 bytes. The shared
product metadata uses the actual square image dimensions. Existing texture
images and image-view interactions are unchanged. Purchase and concern-product
thumbnails also read the same shared primary image paths.

The shared product visual is used on home cards, catalog cards, detail pages,
and registered products. Fine-pointer hover crossfades to the texture; moving
away restores the primary image. Keyboard focus on product buttons exposes the
same texture. Touch users can open product details directly. Reduced-motion
settings disable the fade animation. Product-specific URLs and QR assets remain
independent of the imagery.

Product photos and texture views have a static monochrome film-grain overlay.
The shared CSS uses a repeating 160px SVG noise tile with soft-light blending
and `--product-grain-opacity: .16`. The photo container clips the grain, while
buttons and captions stay above it. Purchase and concern thumbnails use the
same `.product-photo` treatment. Source WebP files and standalone QR graphics
are unchanged; the grain does not add animation or intercept pointer input.
