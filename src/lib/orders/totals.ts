export interface OrderItemInput {
  unitPrice: number;
  quantity: number;
}

export interface OrderTotalsInput {
  items: OrderItemInput[];
  discountAmount: number;
  deliveryFee: number;
  commissionRate: number;
}

export interface OrderTotals {
  grossAmount: number;
  commissionBaseAmount: number;
  commissionAmount: number;
  netAmountToStore: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const grossAmount = round2(input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const commissionBaseAmount = round2(Math.max(0, grossAmount - input.discountAmount));
  const commissionAmount = round2(commissionBaseAmount * input.commissionRate);
  const netAmountToStore = round2(grossAmount - input.discountAmount - commissionAmount);

  return { grossAmount, commissionBaseAmount, commissionAmount, netAmountToStore };
}
