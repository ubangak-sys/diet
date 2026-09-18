import type { MetadataRoute } from "next";

// Для статического экспорта (output: "export") маршрут обязан быть статическим
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Рацион+ — расширение рациона",
    short_name: "Рацион+",
    description:
      "Дневник питания, предпочтения семьи и ежедневные ИИ-советы по расширению рациона.",
    start_url: ".",
    scope: ".",
    display: "standalone",
    background_color: "#ecfdf5",
    theme_color: "#10b981",
    lang: "ru",
    icons: [
      { src: "apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
