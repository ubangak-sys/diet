import { supabase } from "./supabase";

// Записывает вердикт по блюду для конкретного профиля (в т.ч. ребёнка):
// 1) upsert в tried_foods (уникально на user_id+dish);
// 2) «зашло» -> в liked_dishes, «не зашло» -> в disliked_dishes.
export async function recordVerdict(
  userId: string,
  dish: string,
  verdict: "liked" | "disliked",
): Promise<void> {
  const name = dish.trim();
  if (!name) return;

  await supabase.from("tried_foods").upsert(
    {
      user_id: userId,
      dish: name,
      verdict,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,dish" },
  );

  const { data: prefs } = await supabase
    .from("preferences")
    .select("liked_dishes, disliked_dishes")
    .eq("user_id", userId)
    .maybeSingle();

  const strip = (arr: unknown): string[] =>
    (Array.isArray(arr) ? arr.map(String) : []).filter(
      (s) => s.trim().toLowerCase() !== name.toLowerCase(),
    );

  const liked = strip(prefs?.liked_dishes);
  const disliked = strip(prefs?.disliked_dishes);

  if (verdict === "liked") liked.push(name);
  else disliked.push(name);

  await supabase.from("preferences").upsert(
    { user_id: userId, liked_dishes: liked, disliked_dishes: disliked },
    { onConflict: "user_id" },
  );
}
