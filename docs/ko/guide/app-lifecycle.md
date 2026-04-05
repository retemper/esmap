# 앱 라이프사이클

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

esmap의 모든 마이크로 프론트엔드는 표준 라이프사이클을 따릅니다:

```
bootstrap → mount → (update) → unmount
```

## 라이프사이클 함수

| 함수              | 호출 시점                       | 필수 여부 |
| ----------------- | ------------------------------- | --------- |
| `bootstrap()`     | 최초 마운트 전 한 번 호출       | 아니오    |
| `mount(el)`       | 라우트가 매칭될 때 호출         | 예        |
| `update(props)`   | props가 변경될 때 호출          | 아니오    |
| `unmount(el)`     | 라우트를 떠날 때 호출           | 예        |

## 예제

```ts
export async function bootstrap() {
  // 일회성 초기화 (예: 설정 로드)
}

export async function mount(container: HTMLElement) {
  container.innerHTML = '<div id="app">Hello</div>';
}

export async function unmount(container: HTMLElement) {
  container.innerHTML = '';
}
```
