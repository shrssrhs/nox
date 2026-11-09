import type { Database } from "./supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
export interface ChannelRow {
  id: string;
  name: string;
  description: string | null;
  mode?: "open" | "owner_only" | null;
  created_by?: string | null;
}
export async function fetchUserChannels(supabase: SupabaseClient<Database>, userId: string): Promise<ChannelRow[]> {
  const { data: memberships, error } = await supabase.from("channel_members").select("channel_id").eq("user_id",userId);
  if (error) throw error;
  const ids=(memberships ?? []).map(row=>row.channel_id);
  if (!ids.length) return [];
  const result=await supabase.from("channels").select("id,name,description,mode,created_by").in("id",ids).order("name");
  if (result.error) throw result.error;
  return (result.data ?? []).map(row => ({...row, mode: row.mode === "owner_only" ? "owner_only" : "open"}));
}
export async function fetchAllChannels(supabase: SupabaseClient<Database>): Promise<ChannelRow[]> {
  const {data,error}=await supabase.from("channels").select("id,name,description").order("name");
  if (error) throw error;
  return data ?? [];
}
