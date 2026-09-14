// ============================================================================
// Supabase Edge Function «ai-advice»
// Вызывает ИИ (DeepSeek, OpenAI-совместимый API) и сохраняет совет.
// Ключ ИИ хранится в секретах Supabase и никогда не попадает в браузер.
//
// Секреты (Supabase Dashboard → Edge Functions → Secrets):
//   AI_API_KEY    — ключ DeepSeek (обязательно)
//   AI_BASE_URL   — базовый URL API, по умолчанию https://api.deepseek.com
//   AI_MODEL      — модель, по умолчанию deepseek-chat
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Ты — персональный нутрициолог. Твоя задача — помочь человеку мягко и безопасно РАСШИРИТЬ пищевой рацион: предложить новые блюда, продукты и приёмы пищи, которых у него ещё не было или которых мало, с учётом его вкусов, аллергий и ограничений.

Правила ответа:
1. Отвечай на русском языке.
2. Учитывай аллергии и ограничения как ЖЁСТКИЕ запреты — никогда не предлагай их нарушать.
3. Опирайся на то, что человек реально ел (фактическое меню) и что ему нравится.
4. Предложи 3–5 конкретных новых блюд/продуктов, которые дополнят рацион.
5. Для каждого совета укажи: что это, почему это полезно именно ему, и в какой приём пищи логично добавить.
6. Будь конкретным, но кратким. Не давай медицинских диагнозов и не назначай лечение.
7. Оформи ответ как структурированный список с эмодзи.`;

function buildPrompt(
  prefs: Record<string, unknown> | null,
  meals: Array<Record<string, unknown>>,
  date: string,
): string {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : [];

  const liked = arr(prefs?.liked_dishes);
  const disliked = arr(prefs?.disliked_dishes);
  const cuisines = arr(prefs?.cuisines);
  const allergies = arr(prefs?.allergies);
  const restrictions = arr(prefs?.dietary_restrictions);
  const goal = prefs?.goal ? String(prefs.goal) : "";
  const notes = prefs?.notes ? String(prefs.notes) : "";

  const mealLines = meals
    .map((m) => {
      const d = String(m.entry_date ?? "");
      const t = String(m.meal_type ?? "");
      const name = String(m.dish_name ?? "");
      return `- ${d} [${t}]: ${name}`;
    })
    .join("\n");

  return `Дата, на которую нужен совет: ${date}

=== ПРЕДПОЧТЕНИЯ ===
Любимые блюда/продукты: ${liked.length ? liked.join(", ") : "не указаны"}
Нелюбимое: ${disliked.length ? disliked.join(", ") : "не указано"}
Любимые кухни: ${cuisines.length ? cuisines.join(", ") : "не указаны"}
Аллергии (ЖЁСТКИЙ запрет): ${allergies.length ? allergies.join(", ") : "нет"}
Ограничения в питании: ${restrictions.length ? restrictions.join(", ") : "нет"}
Цель: ${goal || "расширить рацион"}
Дополнительные заметки: ${notes || "нет"}

=== ФАКТИЧЕСКОЕ МЕНЮ (последние записи) ===
${mealLines || "записей пока нет"}

Составь персональный совет по расширению рациона на указанную дату.`;
}

async function callLLM(prompt: string): Promise<string> {
  const baseUrl =
    Deno.env.get("AI_BASE_URL") || "https://api.deepseek.com";
  const apiKey = Deno.env.get("AI_API_KEY");
  const model = Deno.env.get("AI_MODEL") || "deepseek-chat";

  if (!apiKey) {
    throw new Error(
      "AI_API_KEY не задан. Добавьте секрет в Supabase Dashboard → Edge Functions → Secrets.",
    );
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1400,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Пустой ответ от ИИ");
  return content.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Дата (локальная дата пользователя в формате YYYY-MM-DD)
  let date = new Date().toISOString().slice(0, 10);
  try {
    const body = await req.json();
    if (body?.date && typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      date = body.date;
    }
  } catch (_) {
    // тело не обязательно
  }

  try {
    const [prefsRes, mealsRes] = await Promise.all([
      supabase
        .from("preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("meal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false })
        .limit(60),
    ]);

    const prefs = prefsRes.data ?? null;
    const meals = mealsRes.data ?? [];

    const prompt = buildPrompt(prefs, meals, date);
    const content = await callLLM(prompt);

    const { data: advice, error: insertErr } = await supabase
      .from("daily_advice")
      .upsert(
        { user_id: user.id, advice_date: date, content },
        { onConflict: "user_id,advice_date" },
      )
      .select()
      .single();

    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    return json({ advice });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
