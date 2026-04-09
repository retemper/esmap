---
description: 'import map 관리, 버전 배포, 롤백을 위한 esmap 배포 서버를 실행하세요.'
---

# 서버

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

`@esmap/server`는 런타임에 import map을 관리하는 배포 서버입니다.

## 개요

서버는 다음을 제공합니다:

- **배포 API** — 호스트를 재빌드하지 않고 새 MFE 버전을 푸시
- **롤백** — 이전 버전으로 즉시 되돌리기
- **이력** — 타임스탬프와 함께 모든 배포 기록 추적

## 서버 시작

```bash
esmap serve --port 3000
```

## 배포 API

```bash
esmap deploy \
  --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js
```

## 롤백

```bash
esmap rollback \
  --server http://localhost:3000 \
  --name @myorg/checkout
```
