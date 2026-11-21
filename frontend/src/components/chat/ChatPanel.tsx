'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile, Bell } from 'lucide-react';

export interface ChatMsg {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  content: string;
  isSystem: boolean;
  createdAt: string | Date;
}

interface ChatPanelProps {
  messages: ChatMsg[];
  onSendMessage: (content: string) => void;
  onSendReaction: (emoji: string) => void;
}

const QUICK_EMOJIS = ['🍿', '❤️', '🔥', '👏', '🤣', '😱', '🎉', '🚀'];

export function ChatPanel({
  messages,
  onSendMessage,
  onSendReaction,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputText('');
    }
  };

  const formatMessageTime = (date: string | Date) => {
    try {
      const d = new Date(date);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d101a]/70 rounded-2xl border border-white/10 overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-6">
            <span className="text-3xl mb-2">🍿</span>
            <p className="text-xs font-semibold text-gray-400">The chat room is quiet</p>
            <p className="text-[11px] text-gray-500">Say hello or react with popcorn!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-3 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-gray-300 flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{msg.content}</span>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex items-start gap-2.5 group">
                <img
                  src={
                    msg.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.userId}`
                  }
                  alt={msg.username}
                  className="w-7 h-7 rounded-full bg-indigo-950 border border-white/10 shrink-0 mt-0.5 object-cover"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-200 truncate">
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {formatMessageTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed break-words bg-black/20 p-2 rounded-xl rounded-tl-none border border-white/5">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Emoji Quick Reactions Bar */}
      <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 flex items-center justify-between gap-1">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendReaction(emoji)}
            className="text-base hover:scale-125 transition-transform p-1 rounded-lg hover:bg-white/10"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-black/50 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send a message to the room..."
          className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:border-indigo-500 outline-none"
        />
        <button
          type="submit"
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
