// ============================================================================
// Supabase Edge Function «send-feedback»
// Принимает отзыв/пожелание, сохраняет в БД и (опционально) шлёт на почту.
//
// Секреты (Supabase Dashboard → Edge Functions → Secrets):
//   FEEDBACK_TO_EMAIL   — email, куда слать сообщения (обязательно для email)
//   RESEND_API_KEY      — ключ Resend (resend.com, бесплатный тариф)
//   FEEDBACK_FROM_EMAIL — адрес «от кого» (по умолчанию onboarding@resend.dev)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_) {
    /* ignore */
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!message) return json({ error: "Сообщение не может быть пустым" }, 400);
  if (message.length > 5000) {
    return json({ error: "Сообщение слишком длинное" }, 400);
  }

  // Необязательная привязка к пользователю
  let userId: string | null = null;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  if (anonKey && authHeader) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    } catch (_) {
      /* ignore */
    }
  }

  const db = createClient(supabaseUrl, serviceKey);
  const { error: insertErr } = await db.from("feedback").insert({
    user_id: userId,
    name: name || null,
    email: email || null,
    message,
  });
  if (insertErr) return json({ error: insertErr.message }, 500);

  // Email через Resend (если настроено)
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const toEmail = Deno.env.get("FEEDBACK_TO_EMAIL");
  if (resendKey && toEmail) {
    const fromEmail =
      Deno.env.get("FEEDBACK_FROM_EMAIL") || "onboarding@resend.dev";
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Рацион+ <${fromEmail}>`,
          to: [toEmail],
          subject: "💬 Отзыв/пожелание — Рацион+",
          text: `Имя: ${name || "—"}\nEmail: ${email || "—"}\n\n${message}`,
        }),
      });
    } catch (_) {
      /* email не критичен — сообщение уже сохранено в БД */
    }
  }

  return json({ ok: true });
});
