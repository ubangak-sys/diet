// ============================================================================
// Supabase Edge Function «ai-advice»
// Генерирует персональный или семейный ИИ-совет (DeepSeek, OpenAI-совместимый API).
// Ключ ИИ — в секретах Supabase, никогда не попадает в браузер.
//
// Секреты (Supabase Dashboard → Edge Functions → Secrets):
//   AI_API_KEY    — ключ DeepSeek (обязательно)
//   AI_BASE_URL   — базовый URL API, по умолчанию https://api.deepseek.com
//   AI_MODEL      — модель, по умолчанию deepseek-chat
//
// Тело запроса: { date?: "YYYY-MM-DD", mode?: "personal" | "family" }
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

const FAMILY_SYSTEM_PROMPT = `Ты — семейный нутрициолог. Твоя задача — помочь семье мягко и безопасно РАСШИРИТЬ общий рацион: предложить блюда и продукты, которые подойдут КАЖДОМУ члену семьи и дополнят общий стол.

Правила ответа:
1. Отвечай на русском языке.
2. Аллергии и ограничения КАЖДОГО члена семьи — ЖЁСТКИЙ запрет для всей семьи: блюдо должно подходить всем без исключения.
3. Учитывай вкусы и фактическое меню всех членов семьи.
4. Предложи 4–6 конкретных блюд/продуктов для общего стола.
5. Для каждого совета укажи: что это, почему подходит всей семье, и в какой приём пищи логично добавить.
6. Будь конкретным, но кратким. Не давай медицинских диагнозов.
7. Оформи ответ как структурированный список с эмодзи.`;

type Row = Record<string, unknown>;

function buildPersonalPrompt(
  prefs: Row | null,
  meals: Row[],
  date: string,
): string {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

  const liked = arr(prefs?.liked_dishes);
  const disliked = arr(prefs?.disliked_dishes);
  const cuisines = arr(prefs?.cuisines);
  const allergies = arr(prefs?.allergies);
  const restrictions = arr(prefs?.dietary_restrictions);
  const goal = prefs?.goal ? String(prefs.goal) : "";
  const notes = prefs?.notes ? String(prefs.notes) : "";

  const mealLines = meals
    .map((m) => `- ${String(m.entry_date ?? "")} [${String(m.meal_type ?? "")}]: ${String(m.dish_name ?? "")}`)
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

interface MemberData {
  name: string;
  prefs: Row | null;
  meals: Row[];
}

function buildFamilyPrompt(
  familyName: string,
  members: MemberData[],
  date: string,
): string {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

  const allAllergies = new Set<string>();
  const allRestrictions = new Set<string>();
  for (const m of members) {
    arr(m.prefs?.allergies).forEach((a) => allAllergies.add(a));
    arr(m.prefs?.dietary_restrictions).forEach((r) => allRestrictions.add(r));
  }

  const memberLines = members
    .map((m) => {
      const liked = arr(m.prefs?.liked_dishes).join(", ") || "не указано";
      const disliked = arr(m.prefs?.disliked_dishes).join(", ") || "не указано";
      const cuisines = arr(m.prefs?.cuisines).join(", ") || "не указаны";
      const meals =
        m.meals
          .map((x) => `- ${String(x.entry_date ?? "")} [${String(x.meal_type ?? "")}]: ${String(x.dish_name ?? "")}`)
          .join("\n") || "нет записей";
      return `### ${m.name}\nЛюбит: ${liked}\nНе любит: ${disliked}\nКухни: ${cuisines}\nМеню:\n${meals}`;
    })
    .join("\n\n");

  return `Семья: ${familyName}
Дата, на которую нужен совет: ${date}

=== ОБЩИЕ ОГРАНИЧЕНИЯ (жёсткий запрет для всех) ===
Аллергии/непереносимость: ${[...allAllergies].join(", ") || "нет"}
Ограничения в питании: ${[...allRestrictions].join(", ") || "нет"}

=== ЧЛЕНЫ СЕМЬИ ===
${memberLines}

Составь совет по расширению рациона для ВСЕЙ семьи: предложи блюда и продукты, которые подходят каждому и дополнят общий стол.`;
}

async function callLLM(system: string, prompt: string): Promise<string> {
  const baseUrl = Deno.env.get("AI_BASE_URL") || "https://api.deepseek.com";
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
        { role: "system", content: system },
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

async function personalAdvice(
  db: ReturnType<typeof createClient>,
  userId: string,
  date: string,
): Promise<Row> {
  const [prefsRes, mealsRes] = await Promise.all([
    db.from("preferences").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("meal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(60),
  ]);

  const prompt = buildPersonalPrompt(prefsRes.data ?? null, mealsRes.data ?? [], date);
  const content = await callLLM(SYSTEM_PROMPT, prompt);

  const { data, error } = await db
    .from("daily_advice")
    .upsert(
      { user_id: userId, advice_date: date, content },
      { onConflict: "user_id,advice_date" },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function familyAdvice(
  db: ReturnType<typeof createClient>,
  userId: string,
  date: string,
): Promise<Row> {
  const { data: myMembership, error: mErr } = await db
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .single();
  if (mErr || !myMembership) {
    throw new Error("Вы не состоите в семье");
  }
  const familyId = myMembership.family_id as string;

  const [{ data: familyRow }, { data: memberRows }] = await Promise.all([
    db.from("families").select("name").eq("id", familyId).single(),
    db.from("family_members").select("user_id").eq("family_id", familyId),
  ]);

  const familyName = (familyRow?.name as string) || "Семья";
  const memberIds = (memberRows ?? []).map((r) => r.user_id as string);

  const members: MemberData[] = await Promise.all(
    memberIds.map(async (uid) => {
      const [prefsRes, mealsRes, profileRes] = await Promise.all([
        db.from("preferences").select("*").eq("user_id", uid).maybeSingle(),
        db
          .from("meal_entries")
          .select("*")
          .eq("user_id", uid)
          .order("entry_date", { ascending: false })
          .limit(40),
        db.from("profiles").select("full_name, email").eq("id", uid).maybeSingle(),
      ]);
      const name =
        (profileRes.data?.full_name as string) ||
        String(profileRes.data?.email ?? "").split("@")[0] ||
        "Участник";
      return { name, prefs: prefsRes.data ?? null, meals: mealsRes.data ?? [] };
    }),
  );

  const prompt = buildFamilyPrompt(familyName, members, date);
  const content = await callLLM(FAMILY_SYSTEM_PROMPT, prompt);

  const { data, error } = await db
    .from("family_advice")
    .upsert(
      { family_id: familyId, advice_date: date, content },
      { onConflict: "family_id,advice_date" },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  // Проверяем авторизацию пользователя по его JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Для чтения данных всей семьи используем service-role (обход RLS допустим:
  // функция серверная и работает только с данными семьи авторизованного пользователя).
  const db = createClient(supabaseUrl, serviceKey);

  // Дата (локальная дата пользователя в формате YYYY-MM-DD)
  let date = new Date().toISOString().slice(0, 10);
  let mode: "personal" | "family" = "personal";
  try {
    const body = await req.json();
    if (body?.date && typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      date = body.date;
    }
    if (body?.mode === "family") mode = "family";
  } catch (_) {
    // тело не обязательно
  }

  try {
    const advice =
      mode === "family"
        ? await familyAdvice(db, user.id, date)
        : await personalAdvice(db, user.id, date);
    return json({ advice, mode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
