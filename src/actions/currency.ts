"use server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function getCurrencyBalance(communityId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("currency_transactions")
    .select("amount")
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  return (data ?? []).reduce((sum, t) => sum + t.amount, 0);
}

export async function awardCurrency(
  communityId: string,
  userId: string,
  amount: number,
  reason: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("award_currency", {
    _community_id: communityId,
    _user_id: userId,
    _amount: amount,
    _reason: reason,
  });
  if (error) return { error: error.message };
  return { success: true };
}
