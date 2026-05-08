"use client";

import { supabase } from "./supabase-client";

export async function saveCloudData<T>(key: string, value: T) {
  if (!supabase) {
    return;
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return;
  }

  await supabase.from("app_data").upsert(
    {
      user_id: user.id,
      key,
      value,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,key" }
  );
}
