import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCommunityBySlug, getMembership, meetsRole } from "@/lib/rbac";
import { listChannels, listMessages } from "@/actions/chat";
import { ChatView } from "./chat-view";

export default async function ChannelChatPage({
  params,
}: {
  params: Promise<{ slug: string; channelId: string }>;
}) {
  const { slug, channelId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const community = await getCommunityBySlug(supabase, slug);
  const membership = await getMembership(supabase, community.id, user.id);
  if (!membership) redirect(`/c/${slug}`);

  const [channels, messages] = await Promise.all([
    listChannels(community.id),
    listMessages(community.id, channelId),
  ]);

  const currentChannel = channels.find((c) => c.id === channelId);
  const isMentor = meetsRole(membership.role, "mentor");

  return (
    <ChatView
      channels={channels}
      currentChannelId={channelId}
      currentChannelName={currentChannel?.name ?? "Unknown"}
      initialMessages={messages}
      communityId={community.id}
      userId={user.id}
      isMentor={isMentor}
      slug={slug}
    />
  );
}
