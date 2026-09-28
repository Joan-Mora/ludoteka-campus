import { Router } from "express";
import { z } from "zod";
import { query } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";
import { requireAuth, type AuthedRequest } from "../../shared/middleware/auth";
import { config } from "../../shared/config";

export const practiceRouter = Router();

const chatBody = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

async function hasActiveKiosk(userId: string): Promise<boolean> {
  const found = await query(
    `SELECT 1
     FROM quiz_attempts a
     JOIN quiz_sessions s ON s.id = a.session_id
     WHERE a.user_id = $1
       AND a.status = 'active'
       AND s.status = 'live'
     LIMIT 1`,
    [userId],
  );
  return Boolean(found.rowCount);
}

async function tutorReply(message: string, history: { role: string; content: string }[]): Promise<string> {
  if (!config.openaiApiKey) {
    return (
      "Modo lab (sin OPENAI_API_KEY): practica el concepto con pasos claros. " +
      "Reescribe el problema, nombra datos conocidos y elige una operación. " +
      `Tu mensaje: «${message.slice(0, 200)}»`
    );
  }

  const messages = [
    {
      role: "system",
      content:
        "Eres un tutor de matemáticas de primaria/secundaria para EduQuest. " +
        "Solo modo práctica: guía con pistas, no resuelvas exámenes. Sé breve y en español.",
    },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 400,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("OpenAI practice error", resp.status, text);
    throw new AppError(502, "TUTOR_UNAVAILABLE", "Tutor IA no disponible ahora.");
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new AppError(502, "TUTOR_UNAVAILABLE", "Tutor IA sin respuesta.");
  return reply;
}

practiceRouter.post("/practice/chat", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = chatBody.parse(req.body);
    if (await hasActiveKiosk(req.user!.id)) {
      throw new AppError(
        403,
        "KIOSK_ACTIVE",
        "Tutor de práctica bloqueado durante un intento en kiosco.",
      );
    }
    const reply = await tutorReply(body.message, body.history ?? []);
    res.json({ reply });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, "INVALID_BODY", "Mensaje de práctica inválido."));
    }
    next(err);
  }
});
