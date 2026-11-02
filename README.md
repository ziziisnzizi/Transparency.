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

- 홈, 제품 탐색, 제품 상세, 내 제품, 더보기
- 제품명·성분 검색 및 제품 종류 필터
- 홈·제품 탐색의 루틴 순서 표시: 토너 → 세럼 → 크림
- 제품별 사용자 리뷰 작성·삭제와 낮은 별점순 표시, 해당 제품의 평균·개수 집계
- 제품별 예시 리뷰 10개와 직접 입력한 리뷰를 한 목록에서 낮은 별점순 표시(예시는 실제 평점 집계에서 제외)
- 제품 등록, 개봉일 변경, 사용 완료·재개, 삭제
- AI 질문용 텍스트 입력과 글자 수 표시(전송·답변·저장 미연결)
- 개인 제품 기록과 리뷰의 브라우저 localStorage 저장(다른 사용자·기기와 공유되지 않음)
- 제품별 상세 주소·QR 코드와 SVG/PNG 다운로드
- 제품별 구매 화면·수량·배송지 입력·주문 금액 계산·주문 내용 확인/수정
- 흑백·투명 유리 소재를 기준으로 한 전체 화면 디자인
- 모바일 하단 메뉴 및 반응형 CSS

제품과 성분 수치는 콘텐츠 문서의 확인 범위를 따릅니다. 계정 인증, 앱 내 카메라 QR 스캔, AI 답변, 연구 원문 연동, 서버 저장, 결제·주문 접수는 구현되지 않았습니다. 배송지 입력은 현재 화면의 메모리에만 유지합니다.

## 문서와 배포

- [전체 진행 내역·파일 경로·남은 작업](docs/project-handoff.md)
- [화면 정보 구조](docs/information-architecture.md)
- [상세 사용자 흐름](docs/application-flow.md)
- [모바일 와이어프레임 20개 화면 · PNG / SVG / PDF](docs/wireframes/README.md)
- [브랜드 문구·디자인 기준과 검증](docs/brand-direction.md)
- [콘텐츠 적용 상태와 남은 결정](docs/content-status-2026-10-27.md)
- [제품별 예시 리뷰 30개](docs/mock-reviews.md)
- [구매 흐름·제안가·결제 연동 범위](docs/purchase-flow.md)
- 작업 보드: https://github.com/users/ziziisnzizi/projects/1
- Vercel: `vercel.json`, Netlify: `netlify.toml`
- 정적 배포 결과물: `npm run build` 후 `dist/`

공개 접속 주소: https://transparency-web-five.vercel.app/
