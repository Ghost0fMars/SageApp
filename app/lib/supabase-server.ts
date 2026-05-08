import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const FREE_GENERATIONS_MAX = 3;
export const FREE_GENERATIONS_KEY = "sage-free-generations";

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
}

export async function getUserFromRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = getBearerToken(request);

  if (!supabaseUrl || !supabaseAnonKey || !token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function checkAndIncrementFreeGenerations(
  userId: string
): Promise<{ allowed: boolean; used: number }> {
  const adminClient = getAdminClient();
  if (!adminClient) return { allowed: true, used: 0 };

  const { data } = await adminClient
    .from("app_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", FREE_GENERATIONS_KEY)
    .maybeSingle();

  const used = typeof data?.value === "number" ? data.value : 0;

  if (used >= FREE_GENERATIONS_MAX) {
    return { allowed: false, used };
  }

  await adminClient.from("app_data").upsert(
    {
      user_id: userId,
      key: FREE_GENERATIONS_KEY,
      value: used + 1,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,key" }
  );

  return { allowed: true, used: used + 1 };
}
