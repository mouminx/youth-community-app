"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { postMessage, deleteMessage } from "@/actions/chat";

type Message = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string; avatar_url: string } | null;
};

type Channel = {
  id: string;
  name: string;
  read_only?: boolean;
};

export function ChatView({
  channels,
  currentChannelId,
  currentChannelName,
  initialMessages,
  communityId,
  userId,
  isMentor,
  isAdmin,
  isReadOnly,
  slug,
}: {
  channels: Channel[];
  currentChannelId: string;
  currentChannelName: string;
  initialMessages: Message[];
  communityId: string;
  userId: string;
  isMentor: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
  slug: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("messages:" + currentChannelId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "channel_id=eq." + currentChannelId }, async (payload) => {
        const { data } = await supabase
          .from("messages")
          .select("id, content, created_at, user_id, profiles:profiles(display_name, avatar_url)")
          .eq("id", payload.new.id)
          .single();
        if (data) {
          const profiles = Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles;
          const msg: Message = { id: data.id, content: data.content, created_at: data.created_at, user_id: data.user_id, profiles };
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: "channel_id=eq." + currentChannelId }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentChannelId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    const optimistic: Message = {
      id: "opt-" + Date.now(),
      content,
      created_at: new Date().toISOString(),
      user_id: userId,
      profiles: { display_name: "You", avatar_url: "" },
    };
    setMessages((prev) => [...prev, optimistic]);
    const res = await postMessage(communityId, currentChannelId, content);
    if (res.error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else if (res.data) {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, id: res.data!.id } : m));
    }
    setTimeout(() => setSending(false), 1000);
  }

  async function handleDelete(messageId: string) {
    await deleteMessage(messageId, communityId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Channel list sidebar (within chat page) */}
      <aside className={`w-44 shrink-0 border-r border-white/[0.06] overflow-y-auto ${showChannelList ? "flex flex-col" : "hidden"} md:flex md:flex-col`}>
        <div className="px-3 py-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-700">Channels</p>
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={"/c/" + slug + "/chat/" + ch.id}
              className={"flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors " + (
                ch.id === currentChannelId
                  ? "bg-white/[0.07] font-medium text-gray-200"
                  : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
              )}
            >
              <span className="text-gray-600">#</span>
              <span className="flex-1 truncate">{ch.name}</span>
              {ch.read_only && (
                <svg className="h-3 w-3 shrink-0 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
          <button
            type="button"
            onClick={() => setShowChannelList((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white/[0.06] hover:text-gray-300 transition-colors md:hidden"
            aria-label="Toggle channel list"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </button>
          <span className="text-gray-600">#</span>
          <h3 className="text-sm font-semibold text-white">{currentChannelName}</h3>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-xs text-gray-700">Start the conversation in #{currentChannelName}</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const prevMsg = messages[idx - 1];
            const sameAuthor = prevMsg && prevMsg.user_id === msg.user_id &&
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

            return (
              <div key={msg.id} className={"group flex gap-3 rounded-lg px-3 py-1 hover:bg-white/[0.02] " + (sameAuthor ? "mt-0.5" : "mt-3")}>
                {!sameAuthor ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-bold text-indigo-300 mt-0.5">
                    {(msg.profiles?.display_name || "?").charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-7 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  {!sameAuthor && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white">
                        {msg.profiles?.display_name || "Unnamed"}
                      </span>
                      <span className="text-xs text-gray-700">
                        {new Date(msg.created_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-gray-300 leading-relaxed break-words">{msg.content}</p>
                </div>

                {(msg.user_id === userId || isMentor) && !msg.id.startsWith("opt-") && (
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="hidden shrink-0 self-center rounded p-1 text-gray-700 hover:bg-red-500/10 hover:text-red-400 group-hover:block transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.06] px-5 py-3">
          {isReadOnly && !isAdmin ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs text-gray-700">
                #{currentChannelName} is read-only — only admins can post here
              </span>
            </div>
          ) : (
            <form onSubmit={handleSend}>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#18181f] px-4 py-2.5">
                <input
                  type="text"
                  placeholder={"Message #" + currentChannelName}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-700 outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
