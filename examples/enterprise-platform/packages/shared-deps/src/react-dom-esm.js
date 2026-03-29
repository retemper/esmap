/**
 * ReactDOM CJS → ESM 래퍼.
 * react-dom/client의 createRoot, hydrateRoot를 포함한 전체 API를 재공개한다.
 */
import ReactDOM from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';

export const {
  createPortal,
  flushSync,
  unmountComponentAtNode,
  version,
} = ReactDOM;

export { createRoot, hydrateRoot };
export default ReactDOM;
