// The packager embeds public screen primitives and SVG diagrams at this marker.
const DESIGN_DATA = /*__DESIGN_DATA__*/ null;

function paint(value) {
  if (!value || value === 'none') return [];
  let hex = value.replace('#', '');
  if (hex.length === 3) hex = [...hex].map(character => character + character).join('');
  return [{ type: 'SOLID', color: { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255 } }];
}

async function loadFonts() {
  const families = ['Noto Sans KR', 'Noto Sans CJK KR', 'Malgun Gothic', 'Apple SD Gothic Neo'];
  for (const family of families) {
    try {
      const regular = { family, style: 'Regular' };
      await figma.loadFontAsync(regular);
      let bold = { family, style: 'Bold' };
      try { await figma.loadFontAsync(bold); } catch { bold = regular; }
      return { regular, bold };
    } catch { /* Try a Korean-capable family available in this editor. */ }
  }
  throw new Error('Noto Sans KR 글꼴을 사용할 수 없습니다. 피그마에서 이 글꼴을 사용할 수 있게 한 뒤 다시 실행해 주세요.');
}

function primitive(parent, item, fonts) {
  let node;
  if (item.type === 'text') {
    node = figma.createText();
    parent.appendChild(node);
    node.fontName = Number(item.fontWeight || 400) >= 600 ? fonts.bold : fonts.regular;
    node.fontSize = item.fontSize || 12;
    node.characters = item.text || '';
    node.fills = paint(item.fill || '#252525');
    node.textAlignHorizontal = (item.align || 'left').toUpperCase();
    node.textAutoResize = 'HEIGHT';
    node.resize(Math.max(1, item.width || 342), Math.max(1, node.height));
    node.x = item.x;
    node.y = item.y;
    node.name = item.text || '텍스트';
    return node;
  }
  if (item.type === 'line') {
    node = figma.createLine();
    parent.appendChild(node);
    const dx = item.x2 - item.x1;
    const dy = item.y2 - item.y1;
    const length = Math.hypot(dx, dy);
    if (!length) { node.remove(); return null; }
    node.resize(length, 0);
    node.relativeTransform = [[dx / length, -dy / length, item.x1], [dy / length, dx / length, item.y1]];
    node.strokes = paint(item.stroke || '#bdbdbd');
    node.strokeWeight = item.strokeWidth ?? 1;
    node.name = '구분선';
    return node;
  }
  if (item.type === 'rect') node = figma.createRectangle();
  else if (item.type === 'ellipse') node = figma.createEllipse();
  else throw new Error(`지원하지 않는 도형: ${item.type}`);
  parent.appendChild(node);
  node.resize(Math.max(0.01, item.width), Math.max(0.01, item.height));
  node.x = item.x;
  node.y = item.y;
  node.fills = paint(item.fill || 'none');
  node.strokes = paint(item.stroke || 'none');
  node.strokeWeight = item.strokeWidth ?? 1;
  if (item.type === 'rect') node.cornerRadius = item.radius || 0;
  node.name = item.name || (item.type === 'rect' ? '영역' : '아이콘');
  return node;
}

async function main() {
  const fonts = await loadFonts();
  let wireframes;
  let flows;
  try {
    wireframes = figma.createPage();
    flows = figma.createPage();
  } catch {
    if (wireframes) wireframes.remove();
    throw new Error('새 디자인 파일에서 실행해 주세요. 와이어프레임과 플로우차트를 담을 새 페이지 두 개가 필요합니다.');
  }
  wireframes.name = '01 · 모바일 와이어프레임';
  await figma.setCurrentPageAsync(wireframes);
  const frames = [];
  for (const [index, screen] of DESIGN_DATA.screens.entries()) {
    const frame = figma.createFrame();
    wireframes.appendChild(frame);
    frame.name = `${screen.id} / ${screen.title}`;
    frame.resize(DESIGN_DATA.width, DESIGN_DATA.height);
    frame.x = 80 + (index % 5) * (DESIGN_DATA.width + 64);
    frame.y = 120 + Math.floor(index / 5) * (DESIGN_DATA.height + 104);
    frame.fills = [];
    frame.clipsContent = true;
    for (const item of screen.nodes) primitive(frame, item, fonts);
    frames.push(frame);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  flows.name = '02 · 사용자 플로우차트';
  await figma.setCurrentPageAsync(flows);
  let y = 80;
  for (const diagram of DESIGN_DATA.flows) {
    const content = diagram.content.replace(/font-family="[^"]*"/g, `font-family="${fonts.regular.family}"`);
    const node = figma.createNodeFromSvg(content);
    flows.appendChild(node);
    node.name = `${diagram.id} / ${diagram.title}`;
    node.x = 80;
    node.y = y;
    y += node.height + 120;
  }
  await figma.setCurrentPageAsync(wireframes);
  figma.currentPage.selection = frames.slice(0, 5);
  figma.viewport.scrollAndZoomIntoView(frames.slice(0, 5));
  figma.closePlugin(`모바일 화면 ${frames.length}개와 플로우차트 ${DESIGN_DATA.flows.length}개를 만들었습니다. 로컬 사본 저장으로 .fig 파일을 저장할 수 있습니다.`);
}

main().catch(error => figma.closePlugin(error && error.message ? error.message : '가져오기를 완료하지 못했습니다.'));
