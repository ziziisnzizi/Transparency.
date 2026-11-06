# Transparency.

저장소: https://github.com/ziziisnzizi/Transparency.

성분·함량·효능 근거를 살펴보고 제품 사용 기록과 리뷰를 관리하는 한국어 웹앱입니다.

## 실행

Node.js 24 환경에서 설치와 빌드를 확인했습니다.

```sh
npm ci
npm run dev
```

기본 개발 포트는 5173입니다. 이 클라우드 환경의 localhost는 외부 공유 주소가 아닙니다.

```sh
npm run build
npm run preview
npm test
```

npm 기본 캐시 경로에 쓰기 권한이 없으면 `npm ci --cache /tmp/transparency-npm`을 사용하세요.

## 현재 범위

- 홈, 제품 탐색, 내 고민, 제품 상세, 내 제품, 더보기
- ‘내 고민’의 자료 기반 답변, Gemini 제품 연결 문구와 출처별 AI 자료 안내, 성분·제형에 따른 제품 비교
- 모든 메뉴의 화이트 그라데이션 물결 배경, 은은한 포인터 반응·터치 파동과 효과 감소 설정 지원
- 낮은 별점 리뷰에서 해당 사용감 고민 검색으로 이동, 직접 작성한 리뷰만 제품 비교의 참고로 사용
- 제품명·성분 검색 및 제품 종류 필터
- 홈·제품 탐색의 루틴 순서 표시: 토너 → 세럼 → 크림
- 제품별 사용자 리뷰 작성·삭제와 낮은 별점순 표시, 해당 제품의 평균·개수 집계
- 제품별 예시 리뷰 10개와 직접 입력한 리뷰를 한 목록에서 낮은 별점순 표시(전체 건수와 평균 별점에 모두 반영)
- PC는 제품 이미지 위 유리 렌즈 안에서 제형을 확인하고, 모바일·터치 및 WebGL 대체 화면은 ‘제형 보기 / 제품 보기’ 버튼으로 전환(홈·탐색·상세·내 제품)
- [현재 모바일 와이어프레임·플로우차트](https://transparency-web-five.vercel.app/design/mobile/): 26개 화면·상태, 5개 흐름도, SVG·PDF·Figma 가져오기 패키지
- 제품 등록, 달력에서 개봉일 변경, 사용 완료·재개, 삭제
- 질문하기 탭의 Gemini 질문·답변·근거 확인·추천 질문·취소·재시도(서버 키 미등록 시 제품 자료 답변)
- 효능·근거 탭의 국내외 논문 한국어 요약·상세·원문 연결과 성분별 연구 정보 확인율(효과 보장률과 구분)
- 개인 제품 기록과 리뷰의 브라우저 localStorage 저장(다른 사용자·기기와 공유되지 않음)
- 제품별 상세 주소·QR 코드와 SVG/PNG 다운로드
- 제품별 구매 화면·수량·배송지 입력·주문 금액 계산·주문 내용 확인/수정
- 화이트 배경·흑백 글자·투명 유리를 기준으로 한 전체 화면 디자인, 내비게이션·카드·탭·리뷰·질문·구매·모달에 공통 투명 배경·블러 적용
- 모바일 하단 메뉴 및 반응형 CSS

제품과 성분 수치는 콘텐츠 문서의 확인 범위를 따릅니다. 계정 인증, 앱 내 카메라 QR 스캔, 서버 저장, 결제·주문 접수는 구현되지 않았습니다. 내 고민과 제품 질문의 AI 답변은 `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`가 필요합니다. 내 고민의 AI 제품 연결과 자료 검색은 입력한 질문을 서버와 Gemini로 보내며, 검색은 Google·공개 연구자료·위키백과 중 가능한 경로를 사용합니다. 위키백과 검색에는 질문에서 추출한 검색어가 전달될 수 있습니다. AI 연결에 실패해도 기존 자료 기반 답변과 제품 비교를 사용할 수 있습니다. 입력·결과는 브라우저 저장소에 보관하지 않으며, AI 검색은 진단이나 제품 효과를 보장하지 않습니다.

화면 전체에 포인터와 스크롤에 반응하는 유동 그라데이션과 전역 텍스트 렌즈를 적용합니다. 라이트 모드는 흰색·파랑, 다크 모드는 짙은 남색과 청록·오렌지를 사용하며 헤더에서 전환할 수 있습니다. 렌즈는 버튼·내비게이션과 작은 글자를 제외하고 정적 문구에 적용합니다. 구현 범위는 [공통 사이트 효과](docs/site-effects.md)와 [내 고민 문서](docs/concern-search.md)를 확인하세요.

## 문서와 배포

- [전체 진행 내역·파일 경로·남은 작업](docs/project-handoff.md)
- [화면 정보 구조](docs/information-architecture.md)
- [현재 모바일 설계 문서 · Figma 가져오기 안내](public/design/mobile/README-KO.md)
- [원본 기획 사용자 흐름 · 미구현 기능 포함](docs/application-flow.md)
- [초기 기획 와이어프레임 아카이브 · 20개 화면](docs/wireframes/README.md)
- [브랜드 문구·디자인 기준과 검증](docs/brand-direction.md)
- [콘텐츠 적용 상태와 남은 결정](docs/content-status-2026-10-27.md)
- [제품별 예시 리뷰 30개](docs/mock-reviews.md)
- [구매 흐름·제안가·결제 연동 범위](docs/purchase-flow.md)
- [성분 연구 출처와 정보 확인율 산정 기준](docs/evidence-research.md)
- [내 고민 검색·제품 연결·비교 방법](docs/concern-search.md)
- [외부 기사·기관 안내 출처 확인](docs/concern-source-verification.md)
- [Gemini 질문 기능·서버 키 설정](docs/gemini-questions.md)
- 작업 보드: https://github.com/users/ziziisnzizi/projects/1
- Vercel: `vercel.json`, Netlify: `netlify.toml`
- 정적 배포 결과물: `npm run build` 후 `dist/`

공개 접속 주소: https://transparency-web-five.vercel.app/
