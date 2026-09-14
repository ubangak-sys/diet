// Надёжное извлечение текста ошибки из результата supabase.functions.invoke().
// В @supabase/functions-js поле error.context — это объект Response (не JSON),
// поэтому читаем тело ответа асинхронно.

function innerMessage(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.error === "string" && o.error) return o.error;
  if (typeof o.message === "string" && o.message) return o.message;
  if (typeof o.msg === "string" && o.msg) return o.msg;
  if (typeof o.details === "string" && o.details) return o.details;
  return null;
}

export async function extractError(err: unknown): Promise<string> {
  if (!err) return "Неизвестная ошибка";
  const e = err as { context?: unknown; message?: string };

  const ctx = e.context;
  if (ctx != null) {
    // Response — так приходит в FunctionsHttpError/FunctionsRelayError
    if (typeof Response !== "undefined" && ctx instanceof Response) {
      try {
        const text = await ctx.text();
        try {
          const parsed = JSON.parse(text);
          const msg = innerMessage(parsed);
          if (msg) return msg;
        } catch {
          /* тело не JSON */
        }
        return text.trim() || e.message || "Ошибка";
      } catch {
        /* ignore */
      }
    } else if (typeof ctx === "string") {
      try {
        const parsed = JSON.parse(ctx);
        const msg = innerMessage(parsed);
        if (msg) return msg;
      } catch {
        /* ignore */
      }
      return ctx;
    } else if (typeof ctx === "object") {
      const msg = innerMessage(ctx);
      if (msg) return msg;
    }
  }

  return e.message ?? "Неизвестная ошибка";
}
