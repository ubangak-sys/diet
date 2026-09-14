// ============================================================================
// Supabase Edge Function «ai-advice»
// Генерирует персональный совет или рекомендацию по семейному ужину (DeepSeek).
// Ключ ИИ — в секретах Supabase, никогда не попадает в браузер.
//
// Секреты (Supabase Dashboard → Edge Functions → Secrets):
//   AI_API_KEY    — ключ DeepSeek (обязательно)
//   AI_BASE_URL   — базовый URL API, по умолчанию https://api.deepseek.com
//   AI_MODEL      — модель, по умолчанию deepseek-chat
//
// Тело запроса: { date?: "YYYY-MM-DD", mode?: "personal" | "dinner", target_user_id?: string }
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

const DINNER_SYSTEM_PROMPT = `Ты — семейный кулинар и нутрициолог. Составь ПЛАН ужинов на 3–7 дней для всей семьи.

Ответ верни СТРОГО как JSON-объект (без markdown и пояснений вокруг) в таком формате:
{
  "dinners": [
    { "day": 1, "title": "Название блюда", "why": "почему подходит и кому" }
  ],
  "shopping": [
    { "item": "Ингредиент", "amount": "количество на все дни" }
  ],
  "lunchboxes": [
    { "for": "Имя школьника", "note": "что положить с собой" }
  ]
}

Правила:
1. Отвечай на русском.
2. Аллергии и ограничения каждого члена семьи — ЖЁСТКИЙ запрет.
3. Учитывай роль, возраст, вкусы и недавнее меню.
4. dinners — 3–7 ужинов; если вкусы сильно расходятся, основной вариант в title, альтернативу — в why.
5. shopping — единый список покупок на все дни, с количеством.
6. lunchboxes — только для школьников старше 7 лет; если таких нет, верни пустой массив.
7. «Пожелания по ужину» — мягкие, учитывай при возможности.`;

type Row = Record<string, unknown>;

// Минимальный интервал между генерациями одного совета (защита от спама кнопкой «Обновить»)
const MIN_INTERVAL_MS = Number(Deno.env.get("AI_MIN_INTERVAL_MS") || "300000");

interface DinnerPlanItem {
  day?: number | string;
  title: string;
  why?: string;
}
interface ShoppingItem {
  item: string;
  amount?: string;
}
interface LunchboxItem {
  for: string;
  note?: string;
}
interface DinnerPlan {
  dinners: DinnerPlanItem[];
  shopping: ShoppingItem[];
  lunchboxes: LunchboxItem[];
}

function parseDinnerPlan(text: string): DinnerPlan | null {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  const tryParse = (str: string): DinnerPlan | null => {
    try {
      const raw = JSON.parse(str) as Record<string, unknown>;
      const dinners = (Array.isArray(raw.dinners) ? raw.dinners : [])
        .map((d) => {
          const o = (d ?? {}) as Record<string, unknown>;
          return {
            day: o.day ?? o.number,
            title: String(o.title ?? o.dish ?? "").trim(),
            why: o.why != null ? String(o.why) : undefined,
          };
        })
        .filter((d) => d.title);
      const shoppingSrc = Array.isArray(raw.shopping)
        ? raw.shopping
        : Array.isArray(raw.shopping_list)
          ? raw.shopping_list
          : [];
      const shopping = shoppingSrc
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            item: String(o.item ?? o.name ?? "").trim(),
            amount: o.amount != null ? String(o.amount) : undefined,
          };
        })
        .filter((x) => x.item);
      const lunchboxes = (Array.isArray(raw.lunchboxes) ? raw.lunchboxes : [])
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            for: String(o.for ?? "").trim(),
            note: o.note != null ? String(o.note) : undefined,
          };
        })
        .filter((x) => x.for);
      if (dinners.length === 0 && shopping.length === 0 && lunchboxes.length === 0) {
        return null;
      }
      return { dinners, shopping, lunchboxes };
    } catch {
      return null;
    }
  };

  const direct = tryParse(s);
  if (direct) return direct;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(s.slice(start, end + 1));
  return null;
}

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
  role: string; // mom | dad | kid
  age: number | null;
  prefs: Row | null;
  meals: Row[];
}

const ROLE_LABELS: Record<string, string> = {
  mom: "мама",
  dad: "папа",
  kid: "ребёнок",
};

function buildDinnerPrompt(
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
      const roleLabel = ROLE_LABELS[m.role] ?? "участник";
      const ageStr = m.age != null ? `${m.age} лет` : "возраст не указан";
      const liked = arr(m.prefs?.liked_dishes).join(", ") || "не указано";
      const disliked = arr(m.prefs?.disliked_dishes).join(", ") || "не указано";
      const cuisines = arr(m.prefs?.cuisines).join(", ") || "не указаны";
      const wishes = arr(m.prefs?.dinner_wishes).join(", ") || "нет";
      const meals =
        m.meals
          .map((x) => `- ${String(x.entry_date ?? "")} [${String(x.meal_type ?? "")}]: ${String(x.dish_name ?? "")}`)
          .join("\n") || "нет записей";
      return `### ${m.name} (${roleLabel}, ${ageStr})\nЛюбит: ${liked}\nНе любит: ${disliked}\nКухни: ${cuisines}\nПожелания по ужину: ${wishes}\nЕл(а) недавно:\n${meals}`;
    })
    .join("\n\n");

  const schoolKids = members.filter(
    (m) => m.role === "kid" && m.age != null && m.age > 7,
  );
  const schoolSection =
    schoolKids.length > 0
      ? `\n=== ШКОЛЬНИКИ (нужен ланчбокс на завтра) ===\n${schoolKids
          .map((k) => `${k.name} (${k.age} лет)`)
          .join(", ")}`
      : "";

  return `Семья: ${familyName}
Дата ужина: ${date}

=== ОБЩИЕ ОГРАНИЧЕНИЯ (жёсткий запрет для всех блюд) ===
Аллергии/непереносимость: ${[...allAllergies].join(", ") || "нет"}
Ограничения в питании: ${[...allRestrictions].join(", ") || "нет"}

=== ЧЛЕНЫ СЕМЬИ ===
${memberLines}${schoolSection}

Составь JSON-план ужинов на 3–7 дней: dinners, единый shopping-список${schoolKids.length > 0 ? " и lunchboxes для школьников" : ""}. Учти «Пожелания по ужину», но они вторичны по отношению к совместимости.`;
}

async function callLLMOnce(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  timeoutMs: number,
  maxTokens: number,
  json: boolean,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("APP_URL") || "https://ration.example.com",
        "X-Title": "Ration+",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Пустой ответ от ИИ");
    return content.trim();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("TIMEOUT");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callLLM(
  system: string,
  prompt: string,
  opts?: { maxTokens?: number; json?: boolean },
): Promise<string> {
  const baseUrl = Deno.env.get("AI_BASE_URL") || "https://api.deepseek.com";
  const apiKey = Deno.env.get("AI_API_KEY");
  const model = Deno.env.get("AI_MODEL") || "deepseek-chat";
  // Настройки: AI_TIMEOUT_MS — таймаут одной попытки (мс), AI_ATTEMPTS — число попыток
  const timeoutMs = Number(Deno.env.get("AI_TIMEOUT_MS") || "50000");
  const attempts = Number(Deno.env.get("AI_ATTEMPTS") || "2");
  const maxTokens = opts?.maxTokens ?? 1600;
  const json = opts?.json ?? false;

  if (!apiKey) {
    throw new Error(
      "AI_API_KEY не задан. Добавьте секрет в Supabase Dashboard → Edge Functions → Secrets.",
    );
  }

  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callLLMOnce(baseUrl, apiKey, model, system, prompt, timeoutMs, maxTokens, json);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      // Ошибки самого API (неверный ключ, нет баланса, неверная модель) не ретраим
      if (err.message.startsWith("AI API error")) {
        throw err;
      }
      lastError = err;
    }
  }

  const message =
    lastError?.message === "TIMEOUT"
      ? "ИИ не ответил вовремя (таймаут). Попробуйте ещё раз."
      : (lastError?.message ?? "Ошибка ИИ");
  throw new Error(message);
}

async function personalAdvice(
  db: ReturnType<typeof createClient>,
  userId: string,
  date: string,
): Promise<Row> {
  const recent = await db
    .from("daily_advice")
    .select("*")
    .eq("user_id", userId)
    .eq("advice_date", date)
    .maybeSingle();
  if (
    recent.data &&
    Date.now() - new Date(recent.data.created_at as string).getTime() <
      MIN_INTERVAL_MS
  ) {
    return recent.data;
  }

  const [prefsRes, mealsRes] = await Promise.all([
    db.from("preferences").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("meal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(30),
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

async function dinnerAdvice(
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

  const recent = await db
    .from("family_advice")
    .select("*")
    .eq("family_id", familyId)
    .eq("advice_date", date)
    .maybeSingle();
  if (
    recent.data &&
    Date.now() - new Date(recent.data.created_at as string).getTime() <
      MIN_INTERVAL_MS
  ) {
    return recent.data;
  }

  const [{ data: familyRow }, { data: memberRows }] = await Promise.all([
    db.from("families").select("name").eq("id", familyId).single(),
    db
      .from("family_members")
      .select("user_id, member_role")
      .eq("family_id", familyId),
  ]);

  const familyName = (familyRow?.name as string) || "Семья";

  const members: MemberData[] = await Promise.all(
    (memberRows ?? []).map(async (row) => {
      const uid = row.user_id as string;
      const [prefsRes, mealsRes, profileRes] = await Promise.all([
        db.from("preferences").select("*").eq("user_id", uid).maybeSingle(),
        db
          .from("meal_entries")
          .select("*")
          .eq("user_id", uid)
          .order("entry_date", { ascending: false })
          .limit(15),
        db
          .from("profiles")
          .select("full_name, email, age")
          .eq("id", uid)
          .maybeSingle(),
      ]);
      const name =
        (profileRes.data?.full_name as string) ||
        String(profileRes.data?.email ?? "").split("@")[0] ||
        "Участник";
      const age =
        profileRes.data?.age != null
          ? Number(profileRes.data.age)
          : null;
      return {
        name,
        role: String(row.member_role ?? "kid"),
        age,
        prefs: prefsRes.data ?? null,
        meals: mealsRes.data ?? [],
      };
    }),
  );

  const prompt = buildDinnerPrompt(familyName, members, date);
  const content = await callLLM(DINNER_SYSTEM_PROMPT, prompt, {
    maxTokens: 4000,
    json: true,
  });
  const plan = parseDinnerPlan(content);

  const { data, error } = await db
    .from("family_advice")
    .upsert(
      { family_id: familyId, advice_date: date, content, plan: plan ?? null },
      { onConflict: "family_id,advice_date" },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function canManageChild(
  db: ReturnType<typeof createClient>,
  actorId: string,
  targetId: string,
): Promise<boolean> {
  const [{ data: actor }, { data: target }] = await Promise.all([
    db
      .from("family_members")
      .select("family_id, member_role")
      .eq("user_id", actorId)
      .maybeSingle(),
    db
      .from("family_members")
      .select("family_id, member_role")
      .eq("user_id", targetId)
      .maybeSingle(),
  ]);
  return !!(
    actor &&
    target &&
    actor.family_id === target.family_id &&
    (actor.member_role === "mom" || actor.member_role === "dad") &&
    target.member_role === "kid"
  );
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
  let mode: "personal" | "dinner" = "personal";
  let targetUserId: string | null = null;
  try {
    const body = await req.json();
    if (body?.date && typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      date = body.date;
    }
    if (body?.mode === "dinner") mode = "dinner";
    if (
      body?.target_user_id &&
      typeof body.target_user_id === "string" &&
      body.target_user_id !== user.id
    ) {
      targetUserId = body.target_user_id;
    }
  } catch (_) {
    // тело не обязательно
  }

  try {
    if (mode === "personal" && targetUserId) {
      const ok = await canManageChild(db, user.id, targetUserId);
      if (!ok) {
        return json({ error: "Нет доступа к советам этого пользователя" }, 403);
      }
    }
    const advice =
      mode === "dinner"
        ? await dinnerAdvice(db, user.id, date)
        : await personalAdvice(db, targetUserId ?? user.id, date);
    return json({ advice, mode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
