/** CSS class prefix used by the error boundary */
const CLASS_PREFIX = 'esmap-error-boundary';

/**
 * Creates a default fallback DOM element.
 * Includes an error message and a retry button.
 * @param _appName - name of the app that encountered the error
 * @param _error - the error that occurred
 * @param onRetry - callback invoked when the retry button is clicked
 */
export function createDefaultFallback(
  _appName: string,
  _error: Error,
  onRetry: () => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = CLASS_PREFIX;

  const message = document.createElement('p');
  message.textContent = 'Unable to load the app';

  const retryButton = document.createElement('button');
  retryButton.textContent = 'Retry';
  retryButton.addEventListener('click', onRetry);

  wrapper.appendChild(message);
  wrapper.appendChild(retryButton);

  return wrapper;
}

/**
 * Clears the container and renders fallback content.
 * @param container - target DOM element to render the fallback into
 * @param content - HTMLElement or HTML string to render
 */
export function renderFallback(container: HTMLElement, content: HTMLElement | string): void {
  container.innerHTML = '';

  if (typeof content === 'string') {
    container.textContent = content;
  } else {
    container.appendChild(content);
  }
}
