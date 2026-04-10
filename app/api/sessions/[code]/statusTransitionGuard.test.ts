import test from 'node:test';
import assert from 'node:assert/strict';

import { isIllegalSetupReset } from './statusTransitionGuard';

test('tillater setup -> active', () => {
  assert.equal(isIllegalSetupReset('setup', 'active'), false);
});

test('avviser active -> setup', () => {
  assert.equal(isIllegalSetupReset('active', 'setup'), true);
});

test('avviser paused -> setup', () => {
  assert.equal(isIllegalSetupReset('paused', 'setup'), true);
});

test('avviser closed -> setup', () => {
  assert.equal(isIllegalSetupReset('closed', 'setup'), true);
});
