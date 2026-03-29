/**
 * Auth MFE — ReadyGate + 스코프드 이벤트 버스 시연.
 *
 * 시연 포인트:
 * - 로그인 폼 렌더링
 * - 로그인 성공 시 eventBus.emit('auth:login') → host의 ReadyGate.markReady('auth')
 * - 스코프드 통신으로 인증 상태를 다른 MFE에 전파
 */
import { createReactMfeApp } from '@esmap/react';
import { LoginForm } from './LoginForm.js';

export default createReactMfeApp({
  rootComponent: LoginForm,
});
