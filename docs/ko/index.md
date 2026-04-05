---
layout: home

hero:
  name: esmap
  text: 네이티브 import map 기반 마이크로 프론트엔드
  tagline: 빌드 타임 생성, 브라우저 런타임, 배포 서버, 개발자 도구 — 하나의 프레임워크.
  actions:
    - theme: brand
      text: 시작하기
      link: /ko/guide/getting-started
    - theme: alt
      text: GitHub에서 보기
      link: https://github.com/retemper/esmap

features:
  - title: 브라우저 네이티브
    details: W3C Import Maps 기반 — MFE는 브라우저가 네이티브로 해석하는 ESM 모듈입니다.
  - title: 번들러 무관
    details: Vite 플러그인이 포함되어 있지만 필수는 아닙니다. ESM을 출력하는 모든 번들러와 호환됩니다.
  - title: 독립 배포
    details: 호스트를 다시 빌드하지 않고 하나의 MFE만 업데이트하세요. 빌드 타임이 아닌 배포 타임 결합입니다.
  - title: JS + CSS 격리
    details: 프록시 샌드박스, 스냅샷 샌드박스, 스코프 스타일, 전역 오염 감지를 제공합니다.
  - title: 타입 안전한 통신
    details: 완전한 TypeScript 추론을 지원하는 이벤트 버스. 글로벌 상태와 앱 props가 내장되어 있습니다.
  - title: '~17.5 kB gzip 전체'
    details: 필요한 것만 사용하세요 — 각 패키지는 교차 의존성이 없습니다.
---
