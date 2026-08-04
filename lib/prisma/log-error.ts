function sanitizedMessage(error: Error) {
  let message = error.message;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) message = message.replaceAll(databaseUrl, "[DATABASE_URL redacted]");
  return message.replace(/postgres(?:ql)?:\/\/[^\s'\"]+/gi, "postgresql://[redacted]");
}

/** Logs actionable Prisma details without emitting connection strings or secrets. */
export function logServerDatabaseError(context: string, error: unknown) {
  if (!(error instanceof Error)) {
    console.error(context, { error: "Unknown database error" });
    return;
  }
  const prismaError = error as Error & { code?: string; clientVersion?: string };
  console.error(context, {
    name: prismaError.name,
    code: prismaError.code,
    clientVersion: prismaError.clientVersion,
    message: sanitizedMessage(prismaError),
  });
}
