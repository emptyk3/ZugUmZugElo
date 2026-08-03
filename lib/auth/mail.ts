type MailKind = "email-verification" | "password-reset";
export function mailDeliveryConfigured(){return process.env.NODE_ENV!=="production"||Boolean(process.env.MAIL_PROVIDER)}

export async function sendAccountLink(kind: MailKind, recipient: string, path: string, token: string) {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[DEV ${kind}] Link für ${recipient}: ${link}`);
    return;
  }
  throw new Error("Produktiver E-Mail-Versand ist noch nicht konfiguriert.");
}
