# Transparency. 프로젝트 인계 기록

대상 저장소: [`ziziisnzizi/Transparency.`](https://github.com/ziziisnzizi/Transparency.)

최초 작업 저장소: `ziziisnzizi/ziziisnzizi`

대상 작업 보드: https://github.com/users/ziziisnzizi/projects/1

이 문서는 대화에서 진행한 작업과 현재 파일을 요약한 인계 문서입니다. 대화 전문이나 GitHub Projects에 등록된 항목은 아닙니다.

## 진행 경과

1. 클라우드 환경 온보딩: 기존 체크아웃을 확인했습니다. 당시 저장소에는 파일·커밋·원격 브랜치가 없었고 요청된 `main`도 없었습니다. Git 읽기 조회는 성공했습니다.
2. 기획 입력: 사용자가 Transparency.의 홈·제품 탐색·내 제품·더보기 정보 구조를 제공했습니다.
3. 웹앱 구현: Vite와 JavaScript로 한국어 프로토타입 및 반응형 스타일을 작성했습니다.
4. 설치 오류 수정: npm 기본 캐시 경로 쓰기 오류를 `/tmp/transparency-npm` 캐시로 해결했습니다.
5. 빌드 검증: `npm run build` 및 `node --check main.js`가 통과했습니다.
6. 실행: 개발 서버의 시작 로그를 확인했습니다. 브라우저에서 전체 기능을 검증한 것은 아닙니다.
7. 배포 준비: Vercel·Netlify 설정과 정적 사이트 ZIP을 만들었습니다. 호스팅 배포 및 공개 URL 생성은 완료하지 못했습니다.
8. Projects 이전 요청: GitHub API 접근이 네트워크 프록시에서 HTTP 403으로 차단됨을 확인했습니다. API 도메인 추가를 환경 설정 초안에 요청했습니다. 아직 프로젝트 읽기·쓰기 권한은 검증되지 않았습니다.

9. 저장소 이전: 사용자가 지정한 `ziziisnzizi/Transparency.`의 첫 업로드에 소스 코드·화면 구조·진행 문서·배포 설정을 함께 포함했습니다. GitHub Projects 등록과 실제 호스팅 배포는 별도 미완료 작업입니다.

10. 브랜드 디자인 반영: 사용자 제공 문구와 흑백·유리·투명함 기준을 전체 화면에 적용했습니다. 캠페인 콘셉트 이미지를 추가하고, 검색·등록·상태 관리·저장 복원을 Chromium에서 검증했습니다. 모바일 하단 메뉴와 작은 화면의 가로 넘침도 확인했습니다. 상세 기록은 [브랜드 디자인 기준](brand-direction.md)에 있습니다.

## 파일 경로

체크아웃의 현재 절대 경로는 `/workspace/ziziisnzizi`입니다. 다른 환경에서는 저장소 상대 경로를 사용하세요.

| 상대 경로 | 역할 |
| --- | --- |
| `index.html` | 한국어 문서 및 앱 진입점 |
| `main.js` | 예시 제품 데이터, 화면 렌더링, 검색·필터·상태 변경·localStorage 저장 |
| `style.css` | 브랜드 스타일, CSS 제품 일러스트, 모바일 레이아웃 |
| `package.json` | Vite 개발·빌드·미리보기 명령 |
| `package-lock.json` | npm 의존성 잠금 |
| `.gitignore` | node_modules, dist, 로그 제외 |
| `vercel.json` | Vercel 빌드·출력 설정 |
| `netlify.toml` | Netlify 빌드·출력 설정 |
| `README.md` | 실행·배포·범위 요약 |
| `docs/information-architecture.md` | 사용자가 제공한 화면 구조 |
| `docs/application-flow.md` | 사용자가 추가 제공한 상세 사용자 흐름, 미구현 기능 포함 |
| `docs/brand-direction.md` | 브랜드 문구·시각 기준·이미지 출처·검증 결과 |
| `public/images/` | 캠페인 이미지 및 유리 용기 일러스트 |
| `docs/project-handoff.md` | 진행 내역·파일 경로·남은 작업 |
| `dist/` | 생성된 정적 배포 결과물, Git 제외 |

`/workspace/transparency-site.zip`은 정적 배포용 파일이며 소스 전체가 아닙니다. 로컬 파일 경로는 GitHub에서 다운로드할 수 있는 URL이 아닙니다.

## 구현된 기능과 검증 범위

| 항목 | 구현 상태 | 검증 |
| --- | --- | --- |
| 홈·브랜드 소개 | 구현 | 빌드·문법 검사, Chromium 화면·자산 로드 확인 |
| 제품 목록·검색·종류 필터 | 구현 | Chromium 검색·종류 필터·초기화 통과 |
| 상세의 성분·근거·안내·FAQ 탭 | 예시 콘텐츠 구현 | Chromium 탭 클릭·키보드 전환 확인 |
| 등록·개봉일·완료·재개·삭제 | 구현 | Chromium 등록·수정·완료·재개·삭제 검증 통과 |
| 브라우저 localStorage | 구현 | Chromium 새로고침 후 개봉일·완료 상태 복원 통과 |
| 모바일 레이아웃 | CSS 구현 | 390px 화면 캡처 및 390·375·320px 네 메뉴 가로 넘침 없음 확인 |
| 정적 프로덕션 빌드 | 완료 | Vite 6.4.5 빌드 성공 |
| 배포용 ZIP | 생성 | ZIP 무결성 및 index.html 포함 확인 |
| 공개 호스팅 | 미완료 | 인증·접근 필요 |
| GitHub Projects 등록 | 미완료 | API 네트워크 차단 |

## Projects에 등록할 작업

이 표는 등록할 자료입니다. 실제 보드 상태는 아직 변경하지 않았습니다.

| 제목 | 권장 상태 | 완료 기준·관련 경로 |
| --- | --- | --- |
| 정보 구조 및 기본 웹앱 구현 | 완료 후보 | `docs/information-architecture.md`, `main.js`, `style.css`; 화면 검증은 별도 |
| 의존성 설치 및 프로덕션 빌드 | 완료 | `package-lock.json`; `npm ci` 후 `npm run build` |
| 배포 설정 및 업로드 파일 준비 | 완료 | `vercel.json`, `netlify.toml`, 정적 ZIP |
| 브라우저 기능·모바일·접근성 검증 | 일부 완료 | Chromium 핵심 기능·모바일 배치·키보드 탭 전환 확인 완료. 실기기·스크린리더 검증은 남음 |
| 공개 호스팅 배포 | 차단됨 | 호스팅 인증 후 배포하고 외부 URL의 자산 로드·핵심 동작 확인 |
| 실제 제품·성분·연구 자료 연결 | 할 일 | 검증된 출처·시험 조건·한계를 제공; 현 예시 데이터를 대체 |
| QR 제품 식별 구현 | 할 일 | 카메라 권한·스캔·제품 상세 이동 및 실패 처리 |
| 계정·서버 동기화·개인정보 정책 | 할 일 | 인증, 사용자별 데이터, 로그아웃·탈퇴 및 정식 정책 |
| AI 질문·근거 확인 구현 | 할 일 | 근거 기반 응답·출처·오류 처리, API 키의 서버 측 보관 |
| GitHub Projects 연결 | 차단됨 | API 접근·프로젝트 권한 확인 후 기존 항목을 조회하고 보드 등록 |

## 재개할 때

- 현재 체크아웃과 미커밋 파일을 보존하세요. 이 작업 때문에 초기화·삭제하거나 새 worktree를 만들 필요는 없습니다.
- 먼저 GitHub API 접근과 대상 프로젝트 쓰기 권한을 확인하세요. 토큰 값은 채팅·문서·로그에 남기지 마세요.
- 이미 등록된 항목을 조회한 뒤 중복 없이 위 작업을 추가하세요.
- 코드를 업로드할 때는 사용자 변경 사항과 원격 브랜치를 다시 확인하세요. `node_modules/`, `dist/`, 자격 증명은 커밋하지 마세요.
- 빌드 성공과 기능 테스트 성공을 구분하고, 공개 배포 후에만 실제 접속 URL을 기록하세요.
