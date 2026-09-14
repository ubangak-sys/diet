// Базовый путь нужен только для GitHub Pages (сайт живёт по /<имя-репозитория>/).
// Локально и на других хостингах он пустой. GitHub Actions задаёт его через
// NEXT_PUBLIC_BASE_PATH на этапе сборки.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Статический экспорт: деплоится на любой бесплатный хостинг (Cloudflare Pages,
  // GitHub Pages, Netlify), доступный из РФ. Серверная логика (ИИ) живёт в Supabase Edge Function.
  output: "export",
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
