export interface SplitInput {
  userId: string;
  sharePaise?: number; // for exact split
}

export interface SplitResult {
  userId: string;
  sharePaise: number;
}

export interface ExpenseCalculation {
  splits: SplitResult[];
  remainderPaise: number;
}

// Equal Split with deterministic remainder assigned to payer (FR-63, FR-64)
export function calculateEqualSplit(
  amountPaise: number,
  payerId: string,
  participantUserIds: string[]
): ExpenseCalculation {
  if (participantUserIds.length === 0) {
    throw new Error("At least one participant required for split");
  }
  if (!participantUserIds.includes(payerId)) {
    throw new Error("Payer must be a participant in the split");
  }

  const count = participantUserIds.length;
  const baseShare = Math.floor(amountPaise / count);
  const remainder = amountPaise - baseShare * count;

  const splits: SplitResult[] = participantUserIds.map((userId) => ({
    userId,
    sharePaise: userId === payerId ? baseShare + remainder : baseShare,
  }));

  return { splits, remainderPaise: remainder };
}

// Exact Split validation (FR-65)
export function validateExactSplit(
  amountPaise: number,
  splits: SplitResult[]
): boolean {
  const sum = splits.reduce((acc, s) => acc + s.sharePaise, 0);
  return sum === amountPaise;
}

export interface MemberBalance {
  userId: string;
  paidPaise: number;
  owedPaise: number;
  netPaise: number; // positive = should receive, negative = owes
}

export interface SettlementTransfer {
  fromUser: string;
  toUser: string;
  amountPaise: number;
}

// Minimum-payment settle-up algorithm (FR-67)
export function computeSettlements(
  expenses: { payerId: string; amountPaise: number }[],
  splits: { userId: string; sharePaise: number }[]
): { balances: MemberBalance[]; settlements: SettlementTransfer[] } {
  const balanceMap = new Map<string, { paid: number; owed: number }>();

  // Accumulate paid amounts
  for (const exp of expenses) {
    const cur = balanceMap.get(exp.payerId) || { paid: 0, owed: 0 };
    cur.paid += exp.amountPaise;
    balanceMap.set(exp.payerId, cur);
  }

  // Accumulate owed shares
  for (const sp of splits) {
    const cur = balanceMap.get(sp.userId) || { paid: 0, owed: 0 };
    cur.owed += sp.sharePaise;
    balanceMap.set(sp.userId, cur);
  }

  const balances: MemberBalance[] = Array.from(balanceMap.entries()).map(([userId, data]) => ({
    userId,
    paidPaise: data.paid,
    owedPaise: data.owed,
    netPaise: data.paid - data.owed,
  }));

  // Settle-up: greedy matching of debtor to creditor
  const debtors = balances.filter((b) => b.netPaise < 0).map((b) => ({ userId: b.userId, amount: -b.netPaise }));
  const creditors = balances.filter((b) => b.netPaise > 0).map((b) => ({ userId: b.userId, amount: b.netPaise }));

  const settlements: SettlementTransfer[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferAmount = Math.min(debtor.amount, creditor.amount);
    if (transferAmount > 0) {
      settlements.push({
        fromUser: debtor.userId,
        toUser: creditor.userId,
        amountPaise: transferAmount,
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount === 0) dIdx++;
    if (creditor.amount === 0) cIdx++;
  }

  return { balances, settlements };
}
