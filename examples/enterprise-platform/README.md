# Enterprise Platform — esmap 고급 예제

패키지 단위로 분리된 Multi-MFE 프로덕션 데모.

## 아키텍처

```
packages/                         apps/
┌────────────────┐               ┌─────────────────────────┐
│ shared-deps    │ ← React,     │ host (shell)             │
│ (ESM bundles)  │   ReactDOM    │ ├─ createEsmap 전체 플러그인 │
├────────────────┤               │ ├─ ReadyGate 인증 게이팅   │
│ design-system  │ ← Button,    │ ├─ SSE import map 갱신    │
│ (UI library)   │   Card,       │ └─ 네비게이션 바           │
├────────────────┤   theme       ├─────────────────────────┤
│ platform-server│ ← Hono +     │ auth (ReadyGate)         │
│ (import map    │   SSE +       │ ├─ 로그인 폼              │
│  delivery)     │   rollback    │ └─ CustomEvent 브릿지      │
└────────────────┘               ├─────────────────────────┤
                                 │ dashboard (Parcel 중첩)   │
                                 │ ├─ 디자인 시스템 소비       │
                                 │ └─ activity-feed Parcel   │
                                 ├─────────────────────────┤
                                 │ team-directory (keepAlive)│
                                 │ ├─ 상태 보존 (검색/필터)    │
                                 │ └─ lazy() 서브모듈         │
                                 ├─────────────────────────┤
                                 │ activity-feed (듀얼 모드)  │
                                 │ ├─ 라우트: /activity       │
                                 │ └─ Parcel: dashboard 위젯 │
                                 ├─────────────────────────┤
                                 │ legacy-settings (compat)  │
                                 │ ├─ Vanilla JS (no React)  │
                                 │ └─ MF→ImportMap 변환 시연  │
                                 └─────────────────────────┘
```

## 시연하는 고급 기능

| 기능                       | 위치                          | 설명                                                          |
| -------------------------- | ----------------------------- | ------------------------------------------------------------- |
| **공유 의존성 버전 협상**  | `shared-deps` + host config   | `esmapSharedDeps`로 빌드 → `SharedModuleRegistry` 런타임 해석 |
| **Import Map 서버 + SSE**  | `platform-server` + host SSE  | 동적 배포/롤백, SSE로 실시간 import map 갱신                  |
| **ReadyGate 인증 게이팅**  | `auth` + host                 | 인증 전 보호 라우트 차단, `markReady` 후 해제                 |
| **중첩 Parcel**            | `dashboard` → `activity-feed` | `EsmapParcel`로 MFE 안에 MFE 삽입                             |
| **keepAlive 상태 보존**    | `team-directory`              | 라우트 전환 후 복귀 시 검색어/선택 상태 유지                  |
| **듀얼 모드 MFE**          | `activity-feed`               | 동일 컴포넌트가 라우트 페이지 + Parcel 위젯으로 동작          |
| **MFE 내부 코드 스플리팅** | `team-directory` MemberDetail | `lazy()`로 서브모듈 동적 로드                                 |
| **MF 마이그레이션**        | `legacy-settings`             | `@esmap/compat` convertMfToImportMap 실전                     |
| **커스텀 플러그인 작성**   | `host/plugins/audit-log`      | EsmapPlugin 인터페이스 직접 구현, hooks/registry/router 접근  |
| **서버 fetch + fallback**  | `host boot.ts`                | 서버에서 import map 동적 로드, 실패 시 로컬 fallback          |
| **프레임워크 무관성**      | `legacy-settings`             | Vanilla JS MFE (React 없음)                                   |
| **빌드타임 CSS 스코핑**    | 모든 React MFE                | `esmapCssScope` 플러그인으로 FOUC 방지                        |
| **공유 디자인 시스템**     | `design-system` → 여러 MFE    | import map 경유 단일 인스턴스 소비                            |

## 실행

```bash
# 1. 빌드 (shared deps → design system → MFE apps)
pnpm build

# 2. import map 시드
pnpm seed

# 3a. 서버 + 호스트 동시 실행
pnpm preview

# 3b. 또는 개별 실행
pnpm server   # http://localhost:3200 (import map API)
pnpm dev      # http://localhost:3100 (host)
```

## 배포 시뮬레이션 (서버 실행 중)

```bash
# MFE 배포
curl -X PATCH http://localhost:3200/services/@enterprise/dashboard \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://localhost:3100/apps/dashboard/dashboard-v2.js"}'

# 롤백
curl -X POST http://localhost:3200/rollback/@enterprise/dashboard

# 이력 조회
curl http://localhost:3200/history
```

host의 SSE 클라이언트가 변경을 실시간 수신하여 상태 패널에 표시한다.

## 참고

- `pnpm dev`만 단독 실행하면 import map 서버 없이 로컬 fallback으로 동작한다.
  이 경우 shared-deps의 content-hash 파일명이 매칭되지 않으므로, 전체 기능 시연은 `pnpm preview` 사용을 권장한다.
- `pnpm preview`는 빌드 → 시드 → 서버 + 호스트를 순차/동시 실행한다.
- DevTools 오버레이: `Alt+Shift+D`로 토글.
