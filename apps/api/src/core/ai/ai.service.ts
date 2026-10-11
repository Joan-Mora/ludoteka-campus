import { Injectable, Logger } from '@nestjs/common';
import { Env } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** Prefer the reasoning model first (exercise generation, NL to SQL, teacher assistant). */
  smart?: boolean;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Feature tag stored in ai_usage for the "uso de biblioteca e IA" report. */
  feature: string;
  userId?: string | null;
}

export interface ChatResult {
  content: string;
  model: string;
}

const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

/** Gemini 3.5+ ignores sampling parameters and future generations reject them with a 400. */
function acceptsSampling(model: string) {
  const version = /^gemini-(\d+(?:\.\d+)?)/.exec(model)?.[1];
  return version === undefined || Number(version) < 3.5;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AI');

  constructor(
    private readonly env: Env,
    private readonly database: DatabaseService,
  ) {}

  get enabled() {
    return Boolean(this.env.values.AI_API_KEY);
  }

  private get base() {
    return this.env.values.AI_BASE_URL.replace(/\/$/, '');
  }

  private chain(smart?: boolean) {
    const values = this.env.values;
    const fallbacks = values.AI_FALLBACK_MODELS.split(',').map((item) => item.trim()).filter(Boolean);
    const ordered = smart ? [values.AI_MODEL_SMART, values.AI_MODEL, ...fallbacks] : [values.AI_MODEL, ...fallbacks];
    return [...new Set(ordered.filter(Boolean))];
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult | null> {
    if (!this.enabled) return null;
    for (const model of this.chain(options.smart)) {
      try {
        const response = await fetch(`${this.base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.env.values.AI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            ...(acceptsSampling(model) ? { temperature: options.temperature ?? 0.4 } : {}),
            ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
            ...(options.json ? { response_format: { type: 'json_object' } } : {}),
            messages,
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          this.logger.warn(`${model} respondió ${response.status}`);
          if (RETRYABLE.has(response.status)) continue;
          return null;
        }
        const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content ?? '';
        const content = raw.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
        if (!content) continue;
        void this.track(options.feature, model, options.userId ?? null);
        return { content, model };
      } catch (error) {
        this.logger.warn(`${model} falló: ${error instanceof Error ? error.message : error}`);
      }
    }
    return null;
  }

  async chatText(messages: ChatMessage[], options: ChatOptions): Promise<string | null> {
    return (await this.chat(messages, options))?.content ?? null;
  }

  async chatJson<T>(messages: ChatMessage[], options: ChatOptions): Promise<T | null> {
    const result = await this.chat(messages, { ...options, json: true });
    if (!result) return null;
    return parseJsonLoose<T>(result.content);
  }

  async embed(texts: string[], options: { feature: string; userId?: string | null }): Promise<number[][] | null> {
    if (!this.enabled || !texts.length) return null;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64).map((text) => text.slice(0, 6000));
      try {
        const response = await fetch(`${this.base}/embeddings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.env.values.AI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.env.values.AI_EMBED_MODEL, input: batch, dimensions: this.env.values.AI_EMBED_DIM }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          this.logger.warn(`embeddings respondió ${response.status}`);
          return null;
        }
        const data = (await response.json()) as { data?: { embedding: number[]; index?: number }[] };
        const rows = [...(data.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        if (rows.length !== batch.length) return null;
        out.push(...rows.map((row) => row.embedding));
      } catch (error) {
        this.logger.warn(`embeddings falló: ${error instanceof Error ? error.message : error}`);
        return null;
      }
    }
    void this.track(options.feature, this.env.values.AI_EMBED_MODEL, options.userId ?? null);
    return out;
  }

  private async track(feature: string, model: string, userId: string | null) {
    try {
      await this.database.db.insertInto('ai_usage').values({ feature, model, user_id: userId }).execute();
    } catch {
      /* usage tracking must never break the feature */
    }
  }
}

export function parseJsonLoose<T>(raw: string): T | null {
  const fenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = fenced.search(/[[{]/);
  if (start < 0) return null;
  const open = fenced[start];
  const end = fenced.lastIndexOf(open === '[' ? ']' : '}');
  if (end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
