/** 에러 바운더리에서 사용하는 CSS 클래스 접두사 */
const CLASS_PREFIX = 'esmap-error-boundary';

/**
 * 기본 폴백 DOM 요소를 생성한다.
 * 에러 메시지와 다시 시도 버튼을 포함한다.
 * @param _appName - 에러가 발생한 앱 이름
 * @param _error - 발생한 에러
 * @param onRetry - 다시 시도 버튼 클릭 시 호출되는 콜백
 */
export function createDefaultFallback(
  _appName: string,
  _error: Error,
  onRetry: () => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = CLASS_PREFIX;

  const message = document.createElement('p');
  message.textContent = '앱을 불러올 수 없습니다';

  const retryButton = document.createElement('button');
  retryButton.textContent = '다시 시도';
  retryButton.addEventListener('click', onRetry);

  wrapper.appendChild(message);
  wrapper.appendChild(retryButton);

  return wrapper;
}

/**
 * 컨테이너 내용을 지우고 폴백 콘텐츠를 렌더링한다.
 * @param container - 폴백을 렌더링할 대상 DOM 요소
 * @param content - 렌더링할 HTMLElement 또는 HTML 문자열
 */
export function renderFallback(container: HTMLElement, content: HTMLElement | string): void {
  container.innerHTML = '';

  if (typeof content === 'string') {
    container.textContent = content;
  } else {
    container.appendChild(content);
  }
}
