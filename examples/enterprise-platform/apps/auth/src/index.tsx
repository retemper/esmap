/**
 * Auth MFE — ReadyGate + scoped event bus demonstration.
 *
 * Demo points:
 * - Renders a login form
 * - On login success, eventBus.emit('auth:login') -> host's ReadyGate.markReady('auth')
 * - Propagates auth state to other MFEs via scoped communication
 */
import { createReactMfeApp } from '@esmap/react';
import { LoginForm } from './LoginForm.js';

export default createReactMfeApp({
  rootComponent: LoginForm,
});
