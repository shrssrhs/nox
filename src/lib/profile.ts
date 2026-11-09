import type { Tables } from "./supabase/database.types";
type Profile = Tables<"profiles">;
export type PublicProfile = Pick<Profile, "id" | "display_name" | "avatar_url" | "status"> &
  Partial<Pick<Profile, "username" | "bio" | "banner_url" | "badges">>;
