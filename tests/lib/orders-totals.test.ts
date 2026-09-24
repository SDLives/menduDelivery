import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from '@/lib/orders/totals';

describe('computeOrderTotals', () => {
  it('matches the exact example from the spec (100 gross, 10 discount, 6% commission)', () => {
    const totals = computeOrderTotals({
      items: [{ unitPrice: 100, quantity: 1 }],
      discountAmount: 10,
      deliveryFee: 10,
      commissionRate: 0.06,
    });

    expect(totals.grossAmount).toBe(100);
    expect(totals.commissionBaseAmount).toBe(90);
    expect(totals.commissionAmount).toBe(5.4);
    expect(totals.netAmountToStore).toBe(84.6);
  });

  it('sums multiple items with different quantities', () => {
    const totals = computeOrderTotals({
      items: [
        { unitPrice: 22.5, quantity: 2 },
        { unitPrice: 8, quantity: 1 },
      ],
      discountAmount: 0,
      deliveryFee: 6,
      commissionRate: 0.07,
    });

    expect(totals.grossAmount).toBe(53);
    expect(totals.commissionBaseAmount).toBe(53);
    expect(totals.commissionAmount).toBe(3.71);
    expect(totals.netAmountToStore).toBe(49.29);
  });

  it('does not let discount push the commission base below zero', () => {
    const totals = computeOrderTotals({
      items: [{ unitPrice: 10, quantity: 1 }],
      discountAmount: 15,
      deliveryFee: 0,
      commissionRate: 0.07,
    });

    expect(totals.commissionBaseAmount).toBe(0);
    expect(totals.commissionAmount).toBe(0);
  });
});
