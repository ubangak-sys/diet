export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

export interface Preferences {
  user_id: string;
  liked_dishes: string[];
  disliked_dishes: string[];
  cuisines: string[];
  allergies: string[];
  dietary_restrictions: string[];
  goal: string | null;
  notes: string | null;
  updated_at: string;
}

export interface MealEntry {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  meal_type: MealType;
  dish_name: string;
  notes: string | null;
  created_at: string;
}

export interface DailyAdvice {
  id: string;
  user_id: string;
  advice_date: string;
  content: string;
  created_at: string;
}

export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: "breakfast", label: "Завтрак", emoji: "🌅" },
  { value: "lunch", label: "Обед", emoji: "🍲" },
  { value: "dinner", label: "Ужин", emoji: "🌙" },
  { value: "snack", label: "Перекус", emoji: "🍎" },
];

export const mealTypeLabel = (t: MealType): string =>
  MEAL_TYPES.find((m) => m.value === t)?.label ?? t;

export const DIETARY_OPTIONS = [
  "Вегетарианство",
  "Веганство",
  "Без глютена",
  "Без лактозы",
  "Халяль",
  "Кошер",
  "Кето",
  "Низкоуглеводное",
  "Спортивное питание",
] as const;
