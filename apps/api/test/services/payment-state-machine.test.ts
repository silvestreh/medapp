import assert from 'assert';
import { canTransitionPayment } from '../../src/services/payments/payment-state-machine';

describe('payments state machine', () => {
  it('allows the forward happy path', () => {
    assert.strictEqual(canTransitionPayment('pending', 'in_process'), true);
    assert.strictEqual(canTransitionPayment('pending', 'approved'), true);
    assert.strictEqual(canTransitionPayment('in_process', 'approved'), true);
    assert.strictEqual(canTransitionPayment('approved', 'refunded'), true);
    assert.strictEqual(canTransitionPayment('approved', 'charged_back'), true);
  });

  it('allows retried checkout attempts after a rejection', () => {
    assert.strictEqual(canTransitionPayment('rejected', 'in_process'), true);
    assert.strictEqual(canTransitionPayment('rejected', 'approved'), true);
  });

  it('allows the late-webhook resurrect path', () => {
    assert.strictEqual(canTransitionPayment('expired', 'approved'), true);
  });

  it('refuses regressions from stale out-of-order webhooks', () => {
    assert.strictEqual(canTransitionPayment('approved', 'pending'), false);
    assert.strictEqual(canTransitionPayment('approved', 'in_process'), false);
    assert.strictEqual(canTransitionPayment('approved', 'rejected'), false);
    assert.strictEqual(canTransitionPayment('refunded', 'approved'), false);
    assert.strictEqual(canTransitionPayment('charged_back', 'approved'), false);
    assert.strictEqual(canTransitionPayment('cancelled', 'approved'), false);
  });

  it('treats a repeated status as a no-op, not a transition', () => {
    assert.strictEqual(canTransitionPayment('approved', 'approved'), false);
    assert.strictEqual(canTransitionPayment('pending', 'pending'), false);
  });
});
