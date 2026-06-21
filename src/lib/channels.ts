import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChannelRow {
  id: string;
  name: string;
  description: string | null;
  mode?: "open" | "owner_only" | null;
  created_by?: string | null;
}

export async function fetchUserChannels(
  supabase: SupabaseClient,
  userId: string
): Promise<ChannelRow[]> {
  const { data: memberships, error: membersError } = await supabase
    .from("channel_members")
    .select("channel_id")
    .eq("user_id", userId);

  if (membersError) {
    console.error("Failed to load channel memberships:", membersError.message);
    return [];
  }

  const ids = (memberships ?? []).map((row) => row.channel_id);
  if (!ids.length) return [];

  return fetchChannelsByIds(supabase, ids);
}

export async function fetchAllChannels(
  supabase: SupabaseClient
): Promise<ChannelRow[]> {
  const { data, error } = await supabase
    .from("channels")
    .select("id, name, description")
    .order("name");

  if (!error) {
    return (data ?? []) as ChannelRow[];
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("channels")
    .select("id, name")
    .order("name");

  if (fallbackError) {
    console.error("Failed to browse channels:", fallbackError.message);
    return [];
  }

  return (fallback ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: null,
  }));
}

async function fetchChannelsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<ChannelRow[]> {
  // Prefer selecting mode + created_by (needed to enforce owner-only channels in
  // the UI); fall back gracefully if those columns don't exist on this instance.
  const { data, error } = await supabase
    .from("channels")
    .select("id, name, description, mode, created_by")
    .in("id", ids)
    .order("name");

  if (!error) {
    return (data ?? []) as ChannelRow[];
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("channels")
    .select("id, name")
    .in("id", ids)
    .order("name");

  if (fallbackError) {
    console.error("Failed to load channels:", fallbackError.message);
    return [];
  }

  return (fallback ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: null,
  }));
}
