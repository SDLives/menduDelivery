import { describe, it, expect } from 'vitest';
import { isValidTransition } from '@/lib/orders/stateMachine';

describe('isValidTransition', () => {
  it('allows the happy path confirmed -> preparing -> out_for_delivery -> delivered', () => {
    expect(isValidTransition('confirmed', 'preparing')).toBe(true);
    expect(isValidTransition('preparing', 'out_for_delivery')).toBe(true);
    expect(isValidTransition('out_for_delivery', 'delivered')).toBe(true);
  });

  it('allows cancellation up to preparing but not after out_for_delivery', () => {
    expect(isValidTransition('confirmed', 'cancelled')).toBe(true);
    expect(isValidTransition('preparing', 'cancelled')).toBe(true);
    expect(isValidTransition('out_for_delivery', 'cancelled')).toBe(false);
  });

  it('rejects skipping steps or moving backwards', () => {
    expect(isValidTransition('confirmed', 'delivered')).toBe(false);
    expect(isValidTransition('delivered', 'preparing')).toBe(false);
  });
});
