export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  age: number | null;
  avatar_emoji: string | null;
  avatar_color: string | null;
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
  dinner_wishes: string[];
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

// Аватарки: эмодзи + цвет фона
export const AVATAR_EMOJIS = [
  "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷",
  "🐸", "🐵", "🐰", "🐹", "🐧", "🦉", "🦄", "🐢",
  "🐙", "🦋", "🌸", "🌟", "🍀", "🍓", "🍋", "🥑",
];

export const AVATAR_COLORS = [
  "#d1fae5",
  "#dbeafe",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#ffe4e6",
];

export type FamilyRole = "owner" | "member";
export type FamilyMemberRole = "mom" | "dad" | "kid";

export const FAMILY_ROLES: {
  value: FamilyMemberRole;
  label: string;
  emoji: string;
}[] = [
  { value: "mom", label: "Мама", emoji: "👩" },
  { value: "dad", label: "Папа", emoji: "👨" },
  { value: "kid", label: "Ребёнок", emoji: "🧒" },
];

export const familyRoleLabel = (r: FamilyMemberRole): string =>
  FAMILY_ROLES.find((x) => x.value === r)?.label ?? r;

export interface FamilyMember {
  user_id: string;
  role: FamilyRole;
  member_role: FamilyMemberRole;
  full_name: string;
  email: string;
  age: number | null;
  avatar_emoji: string | null;
  avatar_color: string | null;
  joined_at: string;
}

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
  members: FamilyMember[];
}

export interface DinnerPlanItem {
  day?: number | string;
  title: string;
  why?: string;
  variants?: string[];
  time?: string;
  steps?: string[];
}

export interface ShoppingItem {
  item: string;
  amount?: string;
  checked?: boolean;
}

export interface LunchboxItem {
  for: string;
  items?: string[];
  note?: string;
}

export interface DinnerPlan {
  dinners: DinnerPlanItem[];
  shopping: ShoppingItem[];
  lunchboxes: LunchboxItem[];
}

export interface FamilyAdvice {
  id: string;
  family_id: string;
  advice_date: string;
  content: string;
  plan: DinnerPlan | null;
  created_at: string;
}
