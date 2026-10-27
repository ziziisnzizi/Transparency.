"""Generate editable SVG wireframes without application/runtime dependencies."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'docs' / 'wireframes'
W, H = 390, 844
FONT = "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif"

def rect(x,y,w,h,fill='white',stroke='#c9c9c9',r=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'
def text(x,y,value,size=14,fill='#252525',weight=400,anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>'
def line(x,y,x2,y2,color='#d1d1d1'):
    return f'<path d="M{x} {y}L{x2} {y2}" stroke="{color}" fill="none"/>'
def lines(x,y,values,size=13,gap=23,fill='#555'):
    return ''.join(text(x,y+i*gap,v,size,fill) for i,v in enumerate(values))
def placeholder(x,y,w,h,label='제품 이미지'):
    base = rect(x,y,w,h,'#eee','#ccc',5)+line(x,y,x+w,y+h)+line(x+w,y,x,y+h)
    if not label or w < 100: return base
    return base+rect(x+w/2-50,y+h/2-12,100,24,'#eee','none')+text(x+w/2,y+h/2+5,label,11,'#777',anchor='middle')
def field(y,label,value='',h=45):
    return text(24,y,label,12,'#555')+rect(24,y+12,342,h,'#f7f7f7','#ccc',3)+text(38,y+40,value or label+' 입력',13,'#999')
def button(y,label,primary=True,x=24,w=342,h=47):
    return rect(x,y,w,h,'#333' if primary else '#fff','#333' if primary else '#bbb',3)+text(x+w/2,y+h/2+5,label,14,'#fff' if primary else '#333',500,'middle')
def row(y,label,target='',value=''):
    return text(24,y+28,label,14)+text(366,y+28,value or (target+' →' if target else '›'),12,'#777',anchor='end')+line(24,y+49,366,y+49)
def tabs(y,labels,active=0):
    step=342/len(labels)
    return ''.join(text(24+step*(i+.5),y+20,v,11,'#222' if i==active else '#888',500 if i==active else 400,'middle') for i,v in enumerate(labels))+line(24,y+38,366,y+38)+line(24+step*active,y+38,24+step*(active+1),y+38,'#333')
def navbar(active='홈'):
    labels=['홈','제품 탐색','내 제품','더보기']
    s=rect(0,758,390,86,'#fafafa','#ddd')
    for i,v in enumerate(labels):
        cx=49+i*97
        s+=rect(cx-8,774,16,16,'#aaa' if v==active else '#eee','#aaa',3)
        s+=text(cx,810,v,10,'#222' if v==active else '#999',500,'middle')
    return s+rect(135,832,120,4,'#222','none',2)
def frame(content,active=None,back=False):
    base=rect(0,0,W,H,'white','#ccc')+text(26,30,'9:41',14,'#111',600)+rect(140,12,110,28,'#111','none',14)+text(360,29,'▮ ▮  ▰',11,'#111',anchor='end')
    base+=text(24,78,'‹' if back else 'Transparency.',23 if back else 22,'#222',700)
    if back: base+=text(52,77,'Transparency.',18,'#222',600)
    base+=line(0,98,390,98)
    base+=f'<svg x="0" y="100" width="390" height="650" viewBox="0 0 390 650" overflow="hidden">{content}</svg>'
    return base+(navbar(active) if active else rect(135,832,120,4,'#222','none',2))
def title(label,sub=''):
    return text(24,41,label,23,'#222',600)+(text(24,68,sub,12,'#777') if sub else '')
def product_item(y,name='데일리 밸런스 세럼',sub='나이아신아마이드 5% · 30 mL',target='07'):
    return placeholder(24,y,82,94)+text(122,y+25,name,13,'#222',500)+text(122,y+49,sub,10,'#777')+text(122,y+76,'제품 정보 확인 → '+target,10,'#777')+line(24,y+113,366,y+113)
def checkbox(y,label):
    return rect(24,y-12,16,16,'#fafafa','#aaa',2)+text(50,y,label,12,'#555')

screens=[]
def add(id,name,status,content,active=None,back=False,note=''):
    screens.append(dict(id=id,name=name,status=status,svg=frame(content,active,back),note=note))

add('01','로그인','기획',title('가릴 것이 없으니까.','성분부터 사용법까지, Transparency.')+field(120,'이메일','example@email.com')+field(220,'비밀번호','비밀번호 입력')+text(24,325,'이메일 또는 비밀번호를 확인해 주세요.',11,'#777')+button(360,'로그인 → 04 / 제품 링크가 있으면 07')+text(195,445,'회원가입 → 02   |   비밀번호 재설정 → 03',11,'#777',anchor='middle')+lines(24,550,['QR 링크로 접속했다면','로그인 후 해당 제품 상세로 이동합니다.'],12),note='일반 진입 → 04 / QR 링크 진입 → 07')
add('02','회원가입','기획',title('회원가입')+field(95,'이메일')+field(185,'비밀번호')+field(275,'비밀번호 확인')+checkbox(390,'[필수] 이용약관 동의')+checkbox(430,'[필수] 개인정보 수집·이용 동의')+button(490,'가입하기')+rect(24,560,342,62,'#f4f4f4')+text(195,596,'가입 완료 → 로그인 01',13,anchor='middle'),back=True,note='완료 상태를 포함한 구성안 / 약관 별도 확정')
add('03','비밀번호 재설정','기획',title('비밀번호 재설정','가입한 이메일로 인증을 진행합니다.')+field(110,'가입 이메일')+button(195,'인증 메일 보내기',False)+field(295,'새 비밀번호')+field(385,'새 비밀번호 확인')+button(500,'비밀번호 변경 → 로그인 01'),back=True,note='메일 링크로 인증 후 새 비밀번호 입력')
add('04','홈','확장',placeholder(0,0,390,250,'')+rect(16,18,270,113,'#ffffffed','none')+text(30,48,'가릴 것이 없으니까.',23,weight=600)+text(30,81,'Transparency.',23,weight=700)+text(30,109,'극도의 투명함, 손안에서.',12)+button(274,'제품 검색 → 05',False)+text(24,365,'사용 중인 제품',18,weight=600)+text(366,365,'내 제품 → 13',11,'#777',anchor='end')+product_item(385,target='15')+row(520,'브랜드 철학 · 정보 공개 원칙','20')+text(24,615,'※ 사용 중인 제품 요약은 추가 기획',10,'#888'),active='홈',note='제품 검색 → 05 / 요약 → 15 / 브랜드 → 20')
add('05','제품 탐색','구현 기반',title('제품 탐색','궁금했던 성분부터, 제품의 근거까지.')+field(95,'제품명 · 성분명 검색','검색어를 입력하세요')+tabs(175,['전체','세럼','크림','클렌저'])+text(24,245,'03 PRODUCTS',10,'#777')+product_item(268)+product_item(395,'베리어 컴포트 크림','세라마이드 NP 0.1% · 30 mL')+product_item(522,'젠틀 리셋 클렌저','판테놀 1% · 30 mL'),active='제품 탐색',note='제품 선택 → 07 / 등록 경로 → 14 / 결과 없음 → 06')
add('06','검색 결과 없음','구현 기반',title('제품 탐색')+field(95,'제품명 · 성분명 검색','입력한 검색어')+tabs(175,['전체','세럼','크림','클렌저'])+text(195,335,'검색 결과가 없어요.',20,weight=500,anchor='middle')+lines(75,375,['다른 검색어로 다시 찾아보거나','필터를 초기화해 보세요.'],12)+button(460,'검색 · 필터 초기화 → 05',False),active='제품 탐색',note='검색어 수정 또는 초기화 → 05')
add('07','제품 상세 · 성분','구현 기반',placeholder(24,12,342,205)+text(24,253,'Daily Balance Serum',10,'#777')+text(24,284,'데일리 밸런스 세럼',22,weight=600)+text(24,311,'세럼 · 30 mL · 제품 설명',12,'#777')+button(335,'내 제품에 추가 → 14')+tabs(403,['성분·함량','효능·근거','사용 안내','질문하기'])+text(24,484,'나이아신아마이드 5%',18,weight=500)+text(24,516,'핵심 성분의 역할 · 함량 설정 이유',12,'#777')+row(540,'성분 상세 보기','08')+text(24,620,'실제 제품·성분·수치는 확정 전 예시',10,'#888'),active='제품 탐색',back=True,note='성분 → 08 / 근거 → 09 / 사용 → 10 / 질문 → 11')
add('08','성분 상세','기획',title('나이아신아마이드','성분에 대해 확인할 수 있는 정보')+row(100,'표시 함량',value='5% · 예시')+text(24,190,'성분 설명',17,weight=500)+lines(24,225,['성분에 대한 일반적인 설명','[확인된 제품 자료 연결 필요]'])+text(24,315,'이 제품에서의 역할',17,weight=500)+lines(24,350,['배합 목적과 역할','함량을 설정한 이유와 기준'])+text(24,455,'참고 출처',17,weight=500)+row(480,'자료 제목 · 발행기관','원문')+rect(24,570,342,54,'#f4f4f4')+text(38,602,'미공개 정보는 상태와 이유를 표시합니다.',11,'#777'),active='제품 탐색',back=True,note='성분 연구와 완제품 효능을 구분하여 안내')
add('09','효능 · 근거 상세','기획',title('근거를 확인하세요.','완제품 시험 / 성분 연구 구분')+rect(24,95,105,28,'#eee')+text(76,114,'자료 유형',11,anchor='middle')+text(24,162,'자료 제목',19,weight=500)+text(24,191,'발행기관 · 발행연도',12,'#777')+row(220,'시험 대상',value='확인된 자료 입력')+row(275,'시험 기간 · 조건',value='확인된 자료 입력')+text(24,370,'주요 결과',17,weight=500)+lines(24,401,['결과 요약과 수치','[검증된 원문 연결 필요]'])+text(24,473,'한계 · 적용 범위',17,weight=500)+text(24,505,'정보 확인일: YYYY.MM.DD',11,'#777')+button(560,'출처 · 원문 보기 ↗',False),active='제품 탐색',back=True,note='시험 조건·한계·출처까지 제공하는 기획 화면')
add('10','제품 사용 안내','확장',title('첫 사용부터, 마지막까지.')+tabs(82,['성분·함량','효능·근거','사용 안내','질문하기'],2)+row(145,'사용 순서',value='확정된 제품 자료')+row(200,'1회 사용량 · 사용 빈도',value='확정된 제품 자료')+placeholder(24,281,342,130,'용기 눈금 · 잔량 확인 안내')+row(430,'끝까지 사용하는 방법')+row(485,'주의사항 · 보관 · 사용기간')+row(540,'재질 · 부품별 분리배출'),active='제품 탐색',back=True,note='현 안내 탭을 기반으로 세부 콘텐츠 확장')
add('11','질문하기 · AI','확장',title('궁금한 것은, 남김없이.')+text(24,100,'자주 묻는 질문',17,weight=500)+row(117,'개봉일은 어디에서 관리하나요?')+row(172,'성분과 함량은 어디서 확인하나요?')+text(24,270,'AI에게 질문하기',17,weight=500)+rect(24,295,280,57,'#eee','#ccc',5)+text(38,329,'사용 순서가 궁금해요.',13)+rect(24,371,342,140,'#f5f5f5','#ccc',5)+lines(38,401,['근거가 있으면: 답변 · 참고 정보 · 출처','근거가 없으면:','확인 가능한 자료가 없어요.'],12)+field(550,'질문 입력','질문을 입력하세요'),active='제품 탐색',back=True,note='FAQ 일부 구현 / AI 답변·출처 연결은 기획')
add('12','내 제품 · 미등록','구현 기반',title('나의 제품.','나의 사용 기록.')+tabs(90,['사용 중','사용 완료'])+text(195,280,'아직 등록한 제품이 없어요.',19,weight=500,anchor='middle')+text(195,317,'사용하는 제품을 등록해 보세요.',12,'#777',anchor='middle')+button(365,'제품 등록하기 → 05')+text(24,610,'현재 프로토타입은 이 브라우저에 기록 저장',10,'#888'),active='내 제품',note='등록할 제품 검색 → 05 / 등록 폼 → 14')
add('13','내 제품 · 사용 중','확장',title('나의 제품.','개봉일부터 마지막 한 방울까지.')+button(91,'＋ 제품 등록 → 05',False)+tabs(166,['사용 중','사용 완료 → 17'])+product_item(235,sub='개봉일 2026.10.27 · 사용 중',target='15')+product_item(365,'베리어 컴포트 크림','미개봉 · 30 mL','15')+text(24,558,'목록 항목: 제품명 · 개봉일 · 사용 상태',11,'#777'),active='내 제품',note='선택 → 15 / 완료 목록 → 17 / 현 앱은 통합 목록')
add('14','제품 등록','기획',title('내 제품에 추가','선택한 제품의 사용 정보를 입력하세요.')+product_item(95,target='07')+checkbox(255,'미개봉 제품이에요')+field(325,'개봉일','YYYY. MM. DD.')+lines(24,432,['미개봉을 선택하면 개봉일은 입력하지 않습니다.','개봉일은 나중에 수정할 수 있어요.'],11)+button(515,'등록하기 → 13')+text(195,598,'등록 완료 알림',12,'#777',anchor='middle'),active='내 제품',back=True,note='현 앱 즉시 추가 기능을 등록 정보 입력 화면으로 확장')
add('15','내 제품 상세','기획',title('내 제품 상세')+product_item(88,target='07')+row(230,'개봉일',value='2026.10.27')+row(285,'경과일',value='N일 경과')+row(340,'사용 상태',value='사용 중')+row(395,'사용기간',value='제품 표시 기준')+row(475,'사용 안내 · 잔량 확인','10')+button(560,'등록 정보 관리 → 16',False),active='내 제품',back=True,note='현 목록의 개봉일·상태 기능을 별도 상세로 설계')
add('16','등록 정보 관리','확장',title('등록 정보 관리')+field(105,'개봉일 수정','YYYY. MM. DD.')+button(195,'수정 저장 → 15',False)+row(275,'사용 완료 처리','17')+row(335,'사용 중으로 변경','13')+row(395,'등록 삭제')+rect(30,477,330,147,'#f3f3f3','#aaa',8)+text(195,513,'제품과 사용 기록을 삭제할까요?',15,weight=500,anchor='middle')+text(195,540,'삭제한 기록은 복구할 수 없습니다.',11,'#777',anchor='middle')+button(562,'취소',False,48,130,42)+button(562,'삭제 → 13',True,207,130,42),active='내 제품',back=True,note='관리 기능은 구현 / 별도 관리 화면과 모달은 구성안')
add('17','내 제품 · 사용 완료','확장',title('사용을 마친 제품','마지막 한 방울까지 함께한 기록.')+tabs(91,['사용 중 → 13','사용 완료'],1)+product_item(165,sub='사용 완료 · 30 mL',target='15')+product_item(300,'젠틀 리셋 클렌저','사용 완료 · 30 mL','15')+rect(24,478,342,92,'#f4f4f4')+lines(38,509,['다시 사용 중으로 변경하려면','제품 선택 → 등록 정보 관리 → 16'],12),active='내 제품',note='완료 처리 구현 / 완료 목록 분리는 추가 기획')
add('18','더보기','구현 기반',title('Transparency.','극도의 투명함, 손안에서.')+row(105,'브랜드 철학','20')+row(165,'정보 공개 원칙','20')+row(225,'서비스 이용 안내')+row(285,'계정 관리','19')+row(345,'이용약관')+row(405,'개인정보 처리방침')+text(24,560,'성분에 장난 없이.',20,weight=500)+text(24,593,'Transparency.',23,weight=700),active='더보기',note='현 앱은 아코디언 구성 / 계정 기능은 미연결')
add('19','계정 관리','기획',title('계정 관리')+row(100,'가입 이메일',value='example@email.com')+row(175,'비밀번호 변경','03')+row(235,'로그아웃','01')+row(295,'회원 탈퇴')+rect(30,400,330,182,'#f3f3f3','#aaa',8)+text(195,438,'정말 탈퇴하시겠어요?',17,weight=500,anchor='middle')+lines(55,473,['계정과 제품 기록의 삭제 범위는','서비스 정책 확정 후 안내합니다.'],12)+button(520,'취소',False,48,130,42)+button(520,'탈퇴 → 01',True,207,130,42),active='더보기',back=True,note='로그인·계정·서버 데이터 정책 확정 필요')
add('20','브랜드 · 공개 원칙','확장',title('가릴 것이 없으니까.')+text(24,88,'Transparency.',28,weight=700)+placeholder(24,120,342,160,'투명 유리 · 제품 콘셉트')+text(24,326,'성분에 장난 없이.',20,weight=600)+lines(24,364,['무엇을 담았는지.','왜 그만큼 담았는지.','어디까지 확인됐는지.'],14)+row(455,'성분과 함량 공개')+row(510,'근거와 한계 안내')+row(565,'미공개 정보의 상태와 이유 표시'),active='더보기',back=True,note='현재 브랜드 소개를 기반으로 별도 화면 구성')


def svg_doc(inner,w,h,bg='white'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="font-family:{FONT}">{rect(0,0,w,h,bg,"none")}{inner}</svg>'
def tile(s,x,y):
    badge_width=77
    label=text(x,y+22,f'{s["id"]}  {s["name"]}',15,'#f7f7f7',500)
    label+=rect(x+W-badge_width,y+3,badge_width,26,'#666','#aaa',3)+text(x+W-badge_width/2,y+21,s['status'],10,'white',anchor='middle')
    label+=f'<g transform="translate({x},{y+42})">{s["svg"]}</g>'
    label+=text(x,y+H+110,s['note'],10,'#ececec')
    return label

ROOT.mkdir(parents=True,exist_ok=True)
for s in screens:
    (ROOT/'screens'/f'{s["id"]}.svg').write_text(svg_doc(s['svg'],W,H))
cols=5; gap=62; margin=56; top=182; rowh=1040
bw=margin*2+cols*W+(cols-1)*gap
bh=top+4*rowh+38
board=text(margin,60,'Transparency. / MOBILE WIREFRAMES',29,'#fff',600)+text(margin,96,'흑백 구조 설계 · 20개 화면 · 사용자 흐름과 현재 프로토타입 기반',15,'#e3e3e3')+text(margin,128,'구현 기반 = 현재 기능을 재구성  /  확장 = 현재 기능 + 추가 기획  /  기획 = 미구현  ·  → 번호 = 이동할 화면',12,'#ddd')
for row_i,label in enumerate(['01 — 진입 · 계정 · 홈 · 제품 탐색','02 — 제품 정보 · 성분 · 근거 · 사용 안내','03 — 질문 · 내 제품 · 등록 · 상세','04 — 제품 관리 · 완료 · 더보기 · 브랜드']):
    yy=top+row_i*rowh
    board+=text(margin,yy,label,16,'white',500)
    for i,s in enumerate(screens[row_i*5:row_i*5+5]):
        board+=tile(s,margin+i*(W+gap),yy+24)
(ROOT/'overview.svg').write_text(svg_doc(board,bw,bh,'#777'))

pages=[]
for page_i in range(5):
    ww=4*W+3*gap+2*margin; hh=1130
    content=text(margin,50,f'Transparency. / WIREFRAMES {page_i+1:02d}',25,'white',600)+text(margin,83,'구현 기반 / 확장 / 기획 구분 · → 번호로 화면 연결 · 모든 제품 정보는 예시',12,'#ddd')
    for j,s in enumerate(screens[page_i*4:page_i*4+4]):
        content+=tile(s,margin+j*(W+gap),115)
    filename=f'sheet-{page_i+1:02d}.svg'
    (ROOT/filename).write_text(svg_doc(content,ww,hh,'#777'))
    pages.append(f'<section class="sheet"><img src="{filename}" alt="와이어프레임 {page_i+1}페이지"></section>')
(ROOT/'print.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><title>Transparency. 와이어프레임</title><style>@page{size:A3 landscape;margin:10mm}body{margin:0}.sheet{width:400mm;height:276mm;display:flex;align-items:center;justify-content:center;break-after:page}.sheet:last-child{break-after:auto}.sheet img{width:100%;height:auto}</style>'+''.join(pages))
(ROOT/'index.html').write_text('''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transparency. Wireframes</title><style>body{margin:0;background:#777;color:white;font:14px sans-serif}header{padding:24px}a{color:white;margin-right:24px}img{display:block;width:100%;min-width:1250px}section{overflow:auto}</style><header><a href="overview.svg" download>SVG 다운로드</a><a href="overview.png" download>PNG 다운로드</a><a href="wireframes.pdf" download>PDF 다운로드</a></header><section><img src="overview.svg" alt="Transparency. 모바일 와이어프레임 전체 20개 화면"></section></html>''')
print(f'Generated {len(screens)} screens, board {bw} × {bh}, 5 print sheets.')
