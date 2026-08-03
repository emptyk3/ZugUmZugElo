import { AuditAction, Prisma } from "@prisma/client";

export function auditData(input: { actorUserId?: string; action: AuditAction; entityType: string; entityId: string; oldData?: Prisma.InputJsonValue; newData?: Prisma.InputJsonValue; note?: string }) {
  return input;
}
