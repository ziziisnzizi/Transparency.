# Transparency.

저장소: https://github.com/ziziisnzizi/Transparency.

성분·함량·효능 근거를 살펴보고 개인 제품 기록을 관리하는 한국어 웹앱 프로토타입입니다.

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
```

npm 기본 캐시 경로에 쓰기 권한이 없으면 `npm ci --cache /tmp/transparency-npm`을 사용하세요.

## 현재 범위

- 홈, 제품 탐색, 제품 상세, 내 제품, 더보기
- 제품명·성분 검색 및 제품 종류 필터
- 제품 등록, 개봉일 변경, 사용 완료·재개, 삭제
- 개인 제품 기록의 브라우저 localStorage 저장
- 흑백·투명 유리 소재를 기준으로 한 전체 화면 디자인
- 모바일 하단 메뉴 및 반응형 CSS

제품과 성분 수치는 모두 예시입니다. 계정 인증, QR 스캔, AI, 연구 출처 연동, 서버 저장은 구현되지 않았습니다.

## 문서와 배포

- [전체 진행 내역·파일 경로·남은 작업](docs/project-handoff.md)
- [화면 정보 구조](docs/information-architecture.md)
- [상세 사용자 흐름](docs/application-flow.md)
- [모바일 와이어프레임 20개 화면 · PNG / SVG / PDF](docs/wireframes/README.md)
- [브랜드 문구·디자인 기준과 검증](docs/brand-direction.md)
- 작업 보드: https://github.com/users/ziziisnzizi/projects/1
- Vercel: `vercel.json`, Netlify: `netlify.toml`
- 정적 배포 결과물: `npm run build` 후 `dist/`

현재 호스팅에 배포되었다는 증거와 공개 접속 URL은 없습니다.
