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
- ‘내 고민’의 단일 검색창, 고민별 논문·외부 기사·기관 안내와 성분·제형에 따른 제품 비교
- 모든 메뉴의 화이트 그라데이션 물결 배경, 은은한 포인터 반응·터치 파동과 효과 감소 설정 지원
- 낮은 별점 리뷰에서 해당 사용감 고민 검색으로 이동, 직접 작성한 리뷰만 제품 비교의 참고로 사용
- 제품명·성분 검색 및 제품 종류 필터
- 홈·제품 탐색의 루틴 순서 표시: 토너 → 세럼 → 크림
- 제품별 사용자 리뷰 작성·삭제와 낮은 별점순 표시, 해당 제품의 평균·개수 집계
- 제품별 예시 리뷰 10개와 직접 입력한 리뷰를 한 목록에서 낮은 별점순 표시(전체 건수와 평균 별점에 모두 반영)
- PC는 제품 이미지 호버로 제형을 확인하고, 모바일·터치 기기는 ‘제형 보기 / 제품 보기’ 버튼으로 전환(홈·탐색·상세·내 제품)
- [현재 모바일 와이어프레임·플로우차트](https://transparency-web-five.vercel.app/design/mobile/): 26개 화면·상태, 5개 흐름도, SVG·PDF·Figma 가져오기 패키지
- 제품 등록, 개봉일 변경, 사용 완료·재개, 삭제
- 질문하기 탭의 Gemini 질문·답변·근거 확인·추천 질문·취소·재시도(서버 키 미등록 시 제품 자료 답변)
- 효능·근거 탭의 국내외 논문 한국어 요약·상세·원문 연결과 성분별 연구 정보 확인율(효과 보장률과 구분)
- 개인 제품 기록과 리뷰의 브라우저 localStorage 저장(다른 사용자·기기와 공유되지 않음)
- 제품별 상세 주소·QR 코드와 SVG/PNG 다운로드
- 제품별 구매 화면·수량·배송지 입력·주문 금액 계산·주문 내용 확인/수정
- 화이트 배경·흑백 글자·투명 유리를 기준으로 한 전체 화면 디자인, 내비게이션·카드·탭·리뷰·질문·구매·모달에 공통 투명 배경·블러 적용
- 모바일 하단 메뉴 및 반응형 CSS

제품과 성분 수치는 콘텐츠 문서의 확인 범위를 따릅니다. 계정 인증, 앱 내 카메라 QR 스캔, 외부 자료 실시간 수집, 서버 저장, 결제·주문 접수는 구현되지 않았습니다. 내 고민 입력·배송지·질문 대화는 현재 화면의 메모리에만 유지합니다. Gemini 생성 답변은 Vercel의 `GEMINI_API_KEY` 등록 및 재배포가 필요하며, 키가 없으면 등록 자료로 안내합니다. ‘내 고민’은 검토한 자료와 공개 제품 정보를 주제에 연결하는 검색이며 AI 진단이나 효과 확률을 제공하지 않습니다. 추가 API 키 없이 동작합니다.

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
