// Original procedural backdrop. Features remain identifiable across a glass edge,
// so the foreground lens can bend the same moving scene rather than fake a rim.
export const liquidScene = `
vec3 scene(vec2 p) {
  vec3 base = mix(vec3(.910, .914, .922), vec3(.028, .031, .036), dark);
  vec2 q = p - vec2(viewport.x * .5, searchRect.y);

  // Broad, slow motion: the whole field responds, not just a small highlight.
  q -= pointer * vec2(34., 22.);
  q.y += 9. * sin(clock * .18) + 5. * sin(clock * .11 + q.x * .004);

  // A tap bends the ribs into a travelling water wave. No coloured ring is drawn.
  for (int i = 0; i < 4; i++) {
    if (i >= rippleCount) break;
    float age = clock - ripples[i].z;
    if (age >= 0. && age < 2.8) {
      vec2 delta = p - ripples[i].xy * viewport;
      float distance = length(delta);
      float front = distance - age * 190.;
      float envelope = exp(-front * front / 9800.) * exp(-age * 1.05);
      q += delta / max(distance, 1.) * sin(front * .045) * envelope * 18.;
    }
  }

  // Uneven, gently curving folds avoid a mechanical grille while leaving
  // identifiable background edges for the lens to magnify and bend.
  float spacing = mix(98., 78., 1. - smoothstep(600., 900., viewport.x));
  float bend = 62. * sin(q.x * .0039 + q.y * .0018 + clock * .12)
             + 17. * sin(q.x * .0085 - q.y * .0024 - clock * .07);
  float along = q.x * .43 + q.y * .90 + bend;
  float phase = along * 6.2831853 / spacing
              + .32 * sin(along * .013 + q.x * .0015 + clock * .045);
  float shoulder = .5 + .5 * sin(phase - .85);
  float reflection = pow(.5 + .5 * cos(phase - .24), 9.);
  float glint = pow(.5 + .5 * cos(phase + .13), 90.);
  float foot = pow(.5 + .5 * cos(phase + .66), 4.);

  float lightValue = .890 - shoulder * .110 - foot * .035
                   + reflection * .105 + glint * .025;
  float darkValue = .035 + shoulder * .018 - foot * .009
                  + reflection * .100 + glint * .045;
  float value = mix(lightValue, darkValue, dark);
  vec3 material = vec3(value) + mix(vec3(-.010, -.004, .006), vec3(-.004, .001, .009), dark);

  // A soft studio reflection makes the ribs read as glass instead of drawn lines.
  float lightSweep = exp(-pow((q.x - 190. - pointer.x * 110.) / 470., 2.));
  material += lightSweep * reflection * mix(.020, .018, dark);

  // Anchor the quiet zone to layout, not pointer motion. Keep useful contrast
  // around the capsule's caps, with a calmer central column under native input.
  float relativeY = p.y - searchRect.y;
  float above = 1. - smoothstep(40., 140., relativeY);
  float below = smoothstep(-245., -105., relativeY);
  float sides = 1. - smoothstep(viewport.x * .36, viewport.x * .66, abs(q.x));
  float centerCalm = mix(.62, 1., smoothstep(searchRect.z * .16, searchRect.z * .48, abs(p.x - searchRect.x)));
  float field = above * below * mix(.72, 1., sides) * centerCalm;
  return clamp(mix(base, material, field), 0., 1.);
}
`;
