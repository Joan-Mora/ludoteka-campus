import { config } from "../../shared/config";

function redactResetUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("token")) u.searchParams.set("token", "[redacted]");
    return u.toString();
  } catch {
    return "[reset-url]";
  }
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "EduQuest — restablecer contraseña";
  const text = `Usa este enlace para restablecer tu contraseña (válido 1 hora):\n${resetUrl}\n\nSi no pediste esto, ignora el correo.`;
  const isProd = process.env.NODE_ENV === "production";

  if (config.resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.smtp.from,
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Resend failed", detail.slice(0, 200));
      throw new Error("EMAIL_SEND_FAILED");
    }
    return;
  }

  if (isProd) {
    throw new Error(
      "EMAIL_PROVIDER_REQUIRED: define RESEND_API_KEY (o cierra SMTP real) en producción.",
    );
  }

  if (config.smtp.host) {
    // Lab only: never log the raw token.
    console.log(
      `[EduQuest reset SMTP stub] host=${config.smtp.host} to=${to} from=${config.smtp.from} url=${redactResetUrl(resetUrl)}`,
    );
    return;
  }

  console.log(`[EduQuest reset mock] ${to} -> ${redactResetUrl(resetUrl)}`);
}