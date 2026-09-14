# 🥗 Рацион+ — расширение пищевого рациона

Персональное веб-приложение, которое помогает мягко и осознанно **расширять
пищевой рацион**: вы ведёте дневник питания и указываете предпочтения, а ИИ
каждый день подсказывает, какие новые блюда и продукты стоит добавить. Можно
объединяться в **семью** и получать общий совет на всю семью.

## Стек

| Слой        | Технология                                                              |
| ----------- | ----------------------------------------------------------------------- |
| Фронтенд    | Next.js (static export) + TypeScript + Tailwind CSS                      |
| База и auth | Supabase (Postgres + Auth, email/пароль)                                |
| ИИ          | Supabase Edge Function → DeepSeek (OpenAI-совместимый API)              |
| Хостинг     | Любой бесплатный статический хостинг, доступный из РФ (Cloudflare Pages, GitHub Pages, Netlify) |

> Ключевая идея архитектуры: **ключ ИИ никогда не попадает в браузер**. Все
> запросы к ИИ идут через Supabase Edge Function, а ключ хранится в секретах
> Supabase. Поэтому фронтенд можно хостить статически где угодно.

---

## 1. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com) (Free-план).
2. Откройте **SQL Editor → New query**, вставьте содержимое
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) и
   выполните (Run). Это создаст таблицы, RLS-политики и триггер профиля.
3. Для функционала семьи выполните также
   [`supabase/migrations/0002_family.sql`](supabase/migrations/0002_family.sql).
4. **Отключите подтверждение email** (для быстрого старта; в продакшене —
   оставьте включённым): **Authentication → Providers → Email** → выключите
   «Confirm email».
5. Возьмите ключи проекта: **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Деплой Edge Function с ИИ (DeepSeek)

Понадобится [Supabase CLI](https://supabase.com/docs/guides/cli) или деплой
функции вручную через Dashboard.

**Вариант А — через Dashboard (проще):**

1. **Edge Functions → New function** → имя `ai-advice`.
2. Вставьте код из [`supabase/functions/ai-advice/index.ts`](supabase/functions/ai-advice/index.ts).
3. **Deploy**.
4. **Edge Functions → Secrets** добавьте секрет:

   | Секрет       | Значение                             |
   | ------------ | ------------------------------------ |
   | `AI_API_KEY` | ваш ключ DeepSeek (`sk-…`)           |

   Остальное уже вшито в код как значения по умолчанию:
   - `AI_BASE_URL` → `https://api.deepseek.com`
   - `AI_MODEL` → `deepseek-chat`

   (Их можно переопределить секретами, если захотите другую модель, например
   `deepseek-reasoner`, или другой OpenAI-совместимый провайдер.)

**Вариант Б — через CLI:**

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set AI_API_KEY=sk-ВАШ-КЛЮЧ
supabase functions deploy ai-advice
```

## 3. Локальный запуск

```bash
cd apps/diet
cp .env.local.example .env.local   # подставьте свои значения
npm install
npm run dev                        # http://localhost:3000
```

Сборка статического сайта:

```bash
npm run build      # результат в папке out/
```

## 4. Деплой фронтенда

Результат `npm run build` — папка `out/`. Её можно задеплоить на любой
статический хостинг:

- **Cloudflare Pages** (рекомендую): подключите репозиторий, build command
  `npm run build`, output directory `out`. Доступен из РФ, бесплатный.
- **GitHub Pages**: задеплойте содержимое `out/` (или через Actions).
- **Netlify**: build command `npm run build`, publish directory `out`.

> Для статической сборки нужны только публичные переменные
> `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` — задайте их в
> настройках хостинга (или в `.env.local` перед сборкой).

## 5. Как это работает

1. Пользователь регистрируется (email + пароль) → Supabase Auth.
2. Указывает предпочтения (любимые/нелюбимые блюда, кухни, аллергии,
   ограничения, цель).
3. Ежедневно вносит фактическое меню по приёмам пищи (завтрак/обед/ужин/перекус).
4. Кнопка «Получить совет» вызывает Edge Function `ai-advice`, которая:
   - проверяет авторизацию пользователя (JWT);
   - загружает предпочтения и последние записи меню;
   - формирует промпт и отправляет его в ИИ (DeepSeek);
   - сохраняет совет в таблицу `daily_advice`.

## 6. Семья 👨‍👩‍👧

Пользователи могут объединяться в семью (одна семья на пользователя):

1. Владелец создаёт семью — автоматически генерируется код-приглашение.
2. Другие пользователи вступают по этому коду (страница «Семья»).
3. Возможности:
   - **Общий дневник** — все видят приёмы пищи друг друга.
   - **Владелец вносит еду за других** (например, родитель за детей).
   - **Родители вносят предпочтения детей** — мама/папа заполняют вкусы,
     аллергии и возраст ребёнка на странице «Профиль и предпочтения».
   - **Родители видят личные советы детей** — на странице «Советы» можно
     переключиться на совет конкретного ребёнка.
   - **Роли членов семьи** — мама / папа / ребёнок + возраст пользователя.
   - **Рекомендация по ужину** — что приготовить на общий семейный ужин
     (при сильных расхождениях во вкусах — до 2–3 блюд) + список покупок
     с количеством. Учитывает «Пожелания по ужину» участников (приоритет
     ниже аллергий/ограничений).

Все операции с семьёй идут через RPC-функции с `SECURITY DEFINER`
(создание, вход по коду, выход, удаление участника, получение семьи), а
безопасность данных обеспечивает Row Level Security.

## 7. Обратная связь

Внизу страницы — малозаметная ссылка «Обратная связь». Отправленные
сообщения сохраняются в таблице `feedback` и (если настроена почта) приходят
разработчику на email через Resend.

Настройка email (Edge Function `send-feedback`):
- секрет `FEEDBACK_TO_EMAIL` — ваш адрес;
- секрет `RESEND_API_KEY` — ключ [resend.com](https://resend.com) (бесплатный тариф);
- `FEEDBACK_FROM_EMAIL` — адрес «от кого» (по умолчанию `onboarding@resend.dev`).

## Структура проекта

```
apps/diet/
├── .github/workflows/deploy.yml      # автодеплой на GitHub Pages
├── supabase/
│   ├── migrations/0001_init.sql      # схема БД + RLS + триггер
│   ├── migrations/0002_family.sql    # семья: таблицы + RPC + RLS
│   ├── migrations/0003_dinner_roles.sql # роли/возраст + ужин
│   ├── migrations/0004_parent_children.sql # родители правят детей
│   ├── migrations/0005_feedback_wishes.sql # пожелания/отзывы/советы детей
│   ├── functions/ai-advice/index.ts  # Edge Function ИИ (личный + ужин)
│   ├── functions/send-feedback/index.ts # Edge Function обратной связи
│   └── config.toml
├── src/
│   ├── app/
│   │   ├── layout.tsx                # корневой layout
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── (app)/                    # авторизованная зона
│   │       ├── layout.tsx            # AuthProvider + RequireAuth + AppShell
│   │       ├── page.tsx              # дашборд
│   │       ├── log/page.tsx          # дневник (общий + личный)
│   │       ├── family/page.tsx       # семья (создать/вступить/участники)
│   │       ├── preferences/page.tsx  # профиль + предпочтения
│   │       └── advice/page.tsx       # личный совет + рекомендация по ужину
│   ├── components/                   # AuthProvider, RequireAuth, AppShell…
│   └── lib/                          # supabase, family (RPC), types, utils
├── .env.local.example
└── package.json
```

## Таблицы БД

- `profiles` — профиль (имя, возраст; создаётся триггером при регистрации).
- `preferences` — предпочтения + пожелания по ужину (одна строка на пользователя).
- `meal_entries` — ежедневный лог приёмов пищи.
- `daily_advice` — персональный ИИ-совет (уникальный на пользователя+дату).
- `families` — семьи (владелец + код-приглашение).
- `family_members` — участники семей (одна семья на пользователя; роль: мама/папа/ребёнок).
- `family_advice` — рекомендация по ужину (уникальный на семью+дату).
- `feedback` — обратная связь (пишет Edge Function, читает разработчик).

Безопасность: включён Row Level Security. Пользователь видит только свои
данные; члены одной семьи — общий дневник; операции с семьёй идут через
RPC-функции с `SECURITY DEFINER`.
