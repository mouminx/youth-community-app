import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership } from "@/lib/rbac";
import { listChannels } from "@/actions/chat";

// /c/[slug]/chat → redirect to first channel, or show empty state.
export default async function ChatIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const channels = await listChannels(community.id);

  if (channels.length > 0) {
    redirect(`/c/${slug}/chat/${channels[0].id}`);
  }

  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500">No channels yet. An admin can create one.</p>
    </div>
  );
}
