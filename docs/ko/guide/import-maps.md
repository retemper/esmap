---
description: "esmap의 기반인 W3C Import Maps 브라우저 네이티브 모듈 해석 표준을 이해하세요."
---

# Import Maps

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

## Import Maps란?

[Import Maps](https://wicg.github.io/import-maps/)는 JavaScript 모듈 지정자(specifier)의 해석 방식을 제어할 수 있는 W3C 브라우저 표준입니다.

```html
<script type="importmap">
  {
    "imports": {
      "@myorg/checkout": "https://cdn.example.com/checkout-v2.js",
      "react": "https://esm.sh/react@18"
    }
  }
</script>
```

Import map이 설정되면 `import '@myorg/checkout'` 같은 bare specifier가 매핑된 URL로 해석됩니다. 런타임에 번들러가 필요하지 않습니다.

## esmap이 Import Maps를 사용하는 방식

esmap은 import map을 생성, 서빙, 동적 업데이트하여 마이크로 프론트엔드를 독립적으로 배포할 수 있게 합니다:

1. **빌드 시점** — `@esmap/vite-plugin`이 각 MFE의 매니페스트를 생성합니다
2. **배포 시점** — `@esmap/cli`가 매니페스트 URL을 import map 서버에 푸시합니다
3. **런타임** — `@esmap/runtime`이 import map을 가져와 페이지에 주입합니다
