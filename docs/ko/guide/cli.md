---
description: "esmap CLI로 매니페스트 생성, 마이크로 프론트엔드 배포, 롤백을 관리하세요."
---

# CLI

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

`@esmap/cli`는 마이크로 프론트엔드의 생성, 배포, 관리를 위한 커맨드라인 도구를 제공합니다.

## 설치

```bash
pnpm add -D @esmap/cli
```

## 명령어

### `esmap generate`

MFE 매니페스트로부터 import map을 생성합니다.

### `esmap serve`

Import map 서버를 시작합니다.

```bash
esmap serve --port 3000
```

### `esmap deploy`

서버에 새 MFE 버전을 배포합니다.

```bash
esmap deploy \
  --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js
```

### `esmap rollback`

이전 버전으로 롤백합니다.

```bash
esmap rollback \
  --server http://localhost:3000 \
  --name @myorg/checkout
```
