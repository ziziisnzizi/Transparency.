# Product images

Product imagery is matched by product slug, so the homepage and routine-ordered
catalog always use the same product and texture pair.

| Product | Primary image | Texture image | Supplied primary file |
| --- | --- | --- | --- |
| Serum S.1 | `public/images/products/serum-s1.webp` | `public/images/textures/serum-s1.webp` | `serum_01(4).png` |
| Toner T.1 | `public/images/products/toner-t1.webp` | `public/images/textures/toner-t1.webp` | `toner_01.png` |
| Cream C.1 | `public/images/products/cream-c1.webp` | `public/images/textures/cream-c1.webp` | `cream_01.png` |

Primary images were replaced on 2026-11-12 with the three supplied 2048 × 2048
PNG photographs, converted to WebP at quality 95 without resizing or cropping.
Their combined size is 2,340,924 bytes. The new framing, labels, QR codes, and
flower-and-grass backgrounds are retained. The shared product metadata uses
the actual square image dimensions. Existing texture images and image-view
interactions are unchanged. Purchase and concern-product thumbnails also read
the same shared primary image paths.

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
same `.product-photo` treatment. The grain is applied only in CSS; it does not
alter the WebP files or standalone QR graphics, add animation, or intercept
pointer input.
