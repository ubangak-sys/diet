// Превращает текст (строки или запятые) в массив строк.
export function textToArray(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Превращает массив строк в многострочный текст.
export function arrayToText(arr: string[] | null | undefined): string {
  return (arr ?? []).join("\n");
}

// Локальная дата в формате YYYY-MM-DD (без сдвига часового пояса).
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateRu(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
