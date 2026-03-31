/**
 * ReactDOM CJS → ESM wrapper.
 * Re-exports the full API including createRoot and hydrateRoot from react-dom/client.
 */
import ReactDOM from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';

export const { createPortal, flushSync, unmountComponentAtNode, version } = ReactDOM;

export { createRoot, hydrateRoot };
export default ReactDOM;
