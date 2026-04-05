# App Lifecycle

::: warning WIP
This page is under construction.
:::

Every micro-frontend in esmap follows a standard lifecycle:

```
bootstrap → mount → (update) → unmount
```

## Lifecycle functions

| Function        | When                            | Required |
| --------------- | ------------------------------- | -------- |
| `bootstrap()`   | Called once, before first mount | No       |
| `mount(el)`     | Called when the route matches   | Yes      |
| `update(props)` | Called when props change        | No       |
| `unmount(el)`   | Called when leaving the route   | Yes      |

## Example

```ts
export async function bootstrap() {
  // One-time initialization (e.g., load config)
}

export async function mount(container: HTMLElement) {
  container.innerHTML = '<div id="app">Hello</div>';
}

export async function unmount(container: HTMLElement) {
  container.innerHTML = '';
}
```
