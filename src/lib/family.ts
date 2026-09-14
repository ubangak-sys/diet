import { supabase } from "./supabase";
import type { Family, FamilyMemberRole } from "./types";

export async function getMyFamily(): Promise<Family | null> {
  const { data, error } = await supabase.rpc("get_my_family");
  if (error) throw new Error(error.message);
  return data as Family | null;
}

// Код без похожих символов (без 0/O, 1/I/L)
export function generateInviteCode(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

export async function createFamily(
  name: string,
  memberRole: FamilyMemberRole,
): Promise<string> {
  const code = generateInviteCode();
  const { data, error } = await supabase.rpc("create_family", {
    fam_name: name,
    fam_code: code,
    fam_role: memberRole,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function joinFamily(
  code: string,
  memberRole: FamilyMemberRole,
): Promise<string> {
  const { data, error } = await supabase.rpc("join_family", {
    fam_code: code,
    fam_role: memberRole,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setFamilyRole(
  userId: string,
  role: FamilyMemberRole,
): Promise<void> {
  const { error } = await supabase.rpc("set_family_role", {
    target: userId,
    new_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function leaveFamily(): Promise<void> {
  const { error } = await supabase.rpc("leave_family");
  if (error) throw new Error(error.message);
}

export async function removeFamilyMember(userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_family_member", {
    target: userId,
  });
  if (error) throw new Error(error.message);
}
