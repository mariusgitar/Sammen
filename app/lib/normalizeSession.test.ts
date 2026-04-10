import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSession } from './normalizeSession';
import { resolveView } from './resolveView';

test('normalizeSession keeps explicit active status and maps participant results visibility', () => {
  const session = normalizeSession({
    id: 's1',
    code: 'ABCD',
    title: 'Test',
    mode: 'kartlegging',
    status: 'active',
    visibility: {
      participant: { showResults: false, showAggregated: true },
    },
  });

  assert.equal(session.status, 'active');
  assert.equal(session.resultsVisible, false);
  assert.equal(resolveView(session).view, 'kartlegging');
});

test('normalizeSession falls back to legacy results_visible and leaves setup waiting view', () => {
  const setupSession = normalizeSession({
    id: 's2',
    code: 'EFGH',
    title: 'Test 2',
    mode: 'stemming',
    status: 'setup',
    results_visible: false,
  });

  assert.equal(setupSession.status, 'setup');
  assert.equal(setupSession.resultsVisible, false);
  const waiting = resolveView(setupSession);
  assert.equal(waiting.view, 'waiting');

  const activeSession = normalizeSession({
    ...setupSession,
    status: 'active',
  });
  assert.equal(activeSession.status, 'active');
  assert.equal(resolveView(activeSession).view, 'stemming');
});
