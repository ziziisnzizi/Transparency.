"""Package the current mobile specification for SVG and native Figma importing."""
from pathlib import Path
from html import escape
from zipfile import ZipFile, ZIP_DEFLATED
import json
import re

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'public' / 'design' / 'mobile'


def load_design():
    design = json.loads((ROOT / 'screens.json').read_text())
    flow_index = json.loads((ROOT / 'flow-index.json').read_text())
    design['flows'] = []
    for flow in flow_index['flows']:
        svg = (ROOT / flow['svg']).read_text()
        clean = re.sub(r'<\?xml.*?\?>|<!DOCTYPE[^>]*>|<!--.*?-->', '', svg, flags=re.S)
        design['flows'].append({**flow, 'content': clean.strip()})
    return design, flow_index


def package():
    design, flow_index = load_design()
    plugin = ROOT / 'figma-plugin'
    plugin.mkdir(parents=True, exist_ok=True)
    manifest = {
        'name': 'Transparency. · 모바일 와이어프레임과 플로우차트',
        'id': 'transparency-mobile-wireframes-local',
        'api': '1.0.0',
        'main': 'code.js',
        'editorType': ['figma'],
        'documentAccess': 'dynamic-page',
        'networkAccess': {'allowedDomains': ['none']},
    }
    (plugin / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    template = (REPO / 'scripts' / 'mobile-figma-plugin.js').read_text()
    assert template.count('/*__DESIGN_DATA__*/ null') == 1
    (plugin / 'code.js').write_text(template.replace('/*__DESIGN_DATA__*/ null', json.dumps(design, ensure_ascii=False, separators=(',', ':'))))
    count = len(design['screens'])
    flow_count = len(flow_index['flows'])
    readme = f'''# Transparency. 모바일 와이어프레임 + 플로우차트

기준: 2026.11.03 현재 구현 / 모바일 {design['width']} × {design['height']} / {count}개 화면·상태 + {flow_count}개 흐름도.

## Figma에서 편집 가능한 화면 만들기

1. ZIP을 풀고 Figma 데스크톱 앱에서 새 디자인 파일을 엽니다.
2. Plugins → Development → Import plugin from manifest…에서 `figma-plugin/manifest.json`을 선택합니다.
3. Development 목록에서 `Transparency. · 모바일 와이어프레임과 플로우차트`를 실행합니다.
4. `01 · 모바일 와이어프레임`, `02 · 사용자 플로우차트` 두 페이지가 생성됩니다.
5. 파일 메뉴의 `Save local copy…`로 `.fig`를 저장합니다.

이 패키지 자체는 네이티브 `.fig` 파일이 아닙니다. Figma 안에서 실제 프레임과 텍스트·도형을 생성하는 가져오기 도구입니다. 와이어프레임은 편집 가능한 Figma 프레임·텍스트·도형으로, 흐름도는 SVG 벡터로 생성됩니다. Auto Layout과 클릭 가능한 프로토타입 연결은 포함하지 않습니다. 실행할 때 기존 페이지를 바꾸지 않고 새 페이지를 만듭니다.

## 플러그인 없이 가져오기

- `screens/`의 SVG를 Figma 캔버스에 드래그하면 화면별로 가져올 수 있습니다.
- `wireframes-board.svg`는 전체 모바일 화면 보드입니다.
- `flows/`의 SVG는 화면 번호와 연결된 플로우차트입니다.
- Mermaid `.mmd`와 Graphviz `.dot`은 흐름도 내용 수정용 원본입니다.
- PDF는 검토·공유용이며, PNG는 빠른 미리보기용입니다.

## 읽는 법

- M01~M{count:02d}: 화면·스크롤 위치·입력 상태를 구분한 모바일 와이어프레임입니다. 같은 URL 안의 탭이나 상태도 별도 프레임으로 표시합니다.
- F01~F{flow_count:02d}: 실제 기능의 이동·조건 분기입니다. 같은 M 번호로 화면과 대조할 수 있습니다.
- 회색 X 영역은 이미지 자리입니다. 제품 사진을 재가공한 자료가 아닙니다.
- 로그인 없이 이용, 외부 카메라 QR로 제품 상세 바로 진입, 내 제품의 통합 목록·인라인 날짜 수정 흐름을 반영했습니다.
- 구매는 상품·배송 정보 입력과 주문 내용 확인까지 구현돼 있으며 실제 결제·주문 접수는 연결돼 있지 않습니다.
- 준비된 리뷰와 직접 작성한 리뷰를 함께 집계합니다. 기록·리뷰는 현재 브라우저, AI 대화·배송 입력은 화면 메모리 범위를 반영했습니다.
- 폰트는 Noto Sans KR입니다. 해당 글꼴을 사용할 수 없으면 설치 또는 Figma 글꼴 사용 설정 후 다시 실행하세요.

## 화면 목록

''' + '\n'.join(f"- {s['id']} · {s['title']} — {s['note']}" for s in design['screens']) + '\n\n## 흐름도 목록\n\n' + '\n'.join(f"- {f['id']} · {f['title']} — {f['description']}" for f in flow_index['flows']) + '\n'
    (ROOT / 'README-KO.md').write_text(readme)
    gallery = []
    for s in design['screens']:
        filename = f"screens/{s['id']}.svg"
        assert (ROOT / filename).is_file(), filename
        gallery.append(f'<article><h3>{escape(s["id"])} · {escape(s["title"])}</h3><a href="{filename}" download><img src="{filename}" alt="{escape(s["title"])}" loading="lazy" width="390" height="844"></a><p>{escape(s["note"])}</p><a href="{filename}" download>SVG 다운로드 ↓</a></article>')
    flow_cards = []
    for f in flow_index['flows']:
        flow_cards.append(f'<article class="flow"><h3>{escape(f["id"])} · {escape(f["title"])}</h3><p>{escape(f["description"])}</p><a href="{escape(f["svg"])}" target="_blank"><img src="{escape(f["svg"])}" alt="{escape(f["title"])}" loading="lazy"></a><a href="{escape(f["svg"])}" download>SVG ↓</a> <a href="{escape(f["mermaid"])}" download>Mermaid 원본 ↓</a></article>')
    page = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transparency. 모바일 와이어프레임 + 플로우차트</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f3f2;color:#202020;font:15px/1.8 'Noto Sans KR','Noto Sans CJK KR',Arial,sans-serif}main{max-width:1500px;margin:auto;padding:60px 28px}h1{font-size:clamp(30px,4vw,52px);line-height:1.3;letter-spacing:-2px;margin:8px 0 20px}h2{margin:56px 0 20px;font-size:25px}h3{font-size:15px;margin:0 0 16px}.eyebrow{font:11px Arial;letter-spacing:2px}.intro{max-width:770px;color:#555}.downloads{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}.downloads a{padding:13px 20px;border:1px solid #bbb;border-radius:30px;text-decoration:none;background:#fff}.downloads a:first-child{background:#202020;color:#fff;border-color:#202020}a{color:inherit}section.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px}article{background:white;border:1px solid #dedede;padding:20px;border-radius:18px;min-width:0}article img{display:block;width:100%;height:auto;border:1px solid #eee}article p{font-size:12px;color:#666;min-height:45px}article>a{font-size:12px}.flow{margin:20px 0}.flow img{max-height:950px;object-fit:contain}.help{background:#fff;padding:25px 30px;border:1px solid #ddd;border-radius:18px;max-width:1000px}.help ol{padding-left:22px}.note{font-size:13px;color:#666}footer{margin-top:50px;font-size:12px;color:#777}@media(max-width:600px){main{padding:32px 18px}section.grid{grid-template-columns:1fr}.help{padding:20px}.downloads a{width:100%;text-align:center}}
</style></head><body><main><span class="eyebrow">TRANSPARENCY. / MOBILE DESIGN DOCUMENTATION</span><h1>모바일 와이어프레임<br>+ 플로우차트.</h1>'''
    page += f'<p class="intro">2026.11.03 현재 앱 기준 · {count}개 모바일 화면·상태 · {flow_count}개 플로우차트. 최근 추가한 제형 전환, 리뷰 집계, Gemini 질문, 구매 입력 흐름을 함께 반영했습니다.</p>'
    page += '<div class="downloads"><a href="transparency-mobile-figma.zip" download>Figma 가져오기 패키지 ZIP ↓</a><a href="wireframes-board.svg" download>전체 와이어프레임 SVG ↓</a><a href="mobile-wireframes.pdf" download>와이어프레임 PDF ↓</a><a href="flowcharts.pdf" download>플로우차트 PDF ↓</a></div>'
    page += '<div class="help"><h3>Figma 파일로 만드는 방법</h3><ol><li>ZIP을 풀고 Figma 데스크톱 앱에서 새 디자인 파일을 엽니다.</li><li>Plugins → Development → Import plugin from manifest…에서 <code>figma-plugin/manifest.json</code>을 선택합니다.</li><li>가져온 플러그인을 실행하면 모바일 와이어프레임과 플로우차트가 각각 새 페이지에 생성됩니다.</li><li><b>Save local copy…</b>로 <b>.fig</b> 파일을 저장합니다.</li></ol><p class="note">ZIP 자체는 .fig 파일이 아닙니다. 와이어프레임은 편집 가능한 프레임·텍스트·도형으로 생성되며, 흐름도는 SVG 벡터입니다. SVG 파일을 직접 캔버스에 드래그하는 방법도 지원합니다.</p></div>'
    page += '<h2>모바일 와이어프레임</h2><section class="grid">' + ''.join(gallery) + '</section><h2>플로우차트</h2>' + ''.join(flow_cards) + '<footer>Transparency. · 현재 구현을 바탕으로 작성한 구조 문서 · 화면 번호와 상태 설명은 README-KO.md 참고</footer></main></body></html>'
    (ROOT / 'index.html').write_text(page)
    make_zip()
    print(f'Packaged {count} screens and {flow_count} flowcharts with an offline Figma importer.')


def make_zip():
    path = ROOT / 'transparency-mobile-figma.zip'
    with ZipFile(path, 'w', ZIP_DEFLATED) as archive:
        for item in sorted(ROOT.rglob('*')):
            if item.is_file() and item != path and item.name not in ['index.html']:
                archive.write(item, Path('transparency-mobile') / item.relative_to(ROOT))


if __name__ == '__main__':
    package()
