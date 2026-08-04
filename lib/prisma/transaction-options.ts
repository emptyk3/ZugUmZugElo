import { Prisma } from "@prisma/client";

/** Shared boundary for transactions that can replay a long Elo history. */
export const ELO_RECALCULATION_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;
