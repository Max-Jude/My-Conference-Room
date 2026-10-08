import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Paperclip,
  Smile,
  Download,
  Lock,
  FileText,
} from 'lucide-react';
import { ChatMessage, Participant } from '../types';

interface ChatSidebarProps {
  messages: ChatMessage[];
  participants: Participant[];
  localParticipant: Participant;
  onSendMessage: (text: string, recipientId?: string, attachment?: any) => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ['👍', '👏', '❤️', '🎉', '😂', '🔥', '🙌', '🚀'];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  participants,
  localParticipant,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const [recipientId, setRecipientId] = useState<string>('everyone');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(
      inputText.trim(),
      recipientId === 'everyone' ? undefined : recipientId
    );
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const attachment = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type || 'document',
      };
      onSendMessage(
        `Shared a file: ${file.name}`,
        recipientId === 'everyone' ? undefined : recipientId,
        attachment
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportChat = () => {
    const text = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.senderName}${
            m.isPrivate ? ' (Direct Message)' : ''
          }: ${m.text}`
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-20 select-none shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">In-Meeting Chat</h2>
          <span className="text-xs text-slate-400">({messages.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={exportChat}
            title="Download Chat Log"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Recipient Dropdown (To: Everyone vs Direct) */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium shrink-0">To:</span>
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="everyone">Everyone in Meeting</option>
          {participants
            .filter((p) => !p.isLocal)
            .map((p) => (
              <option key={p.id} value={p.id}>
                Direct Message: {p.name}
              </option>
            ))}
        </select>
        {recipientId !== 'everyone' && (
          <span title="Private direct message" className="shrink-0 flex items-center">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </span>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400">
              <Smile className="w-6 h-6" />
            </div>
            <p className="text-xs">No chat messages yet.</p>
            <p className="text-[11px] text-slate-600">Messages will appear here for everyone in the room.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === localParticipant.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {msg.senderName} {isMe && '(You)'}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.isPrivate && (
                    <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1 py-0.2 rounded border border-amber-500/30 font-medium">
                      Direct
                    </span>
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? msg.isPrivate
                        ? 'bg-amber-600/90 text-white rounded-br-xs'
                        : 'bg-blue-600 text-white rounded-br-xs'
                      : msg.isPrivate
                      ? 'bg-amber-950/60 border border-amber-800/60 text-amber-200 rounded-bl-xs'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-xs'
                  }`}
                >
                  {msg.text}

                  {msg.attachment && (
                    <div className="mt-2 p-2 rounded-lg bg-black/20 flex items-center gap-2 border border-white/10">
                      <FileText className="w-4 h-4 shrink-0 text-blue-300" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-[11px] text-white">
                          {msg.attachment.name}
                        </p>
                        <p className="text-[10px] text-white/70">
                          {msg.attachment.size}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Bar */}
      <div className="px-3 py-1.5 border-t border-slate-800/60 bg-slate-950/30 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setInputText((prev) => prev + emoji)}
            className="p-1 hover:bg-slate-800 rounded text-base transition-colors shrink-0"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/95 space-y-2">
        <div className="relative flex items-center">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              recipientId === 'everyone'
                ? 'Type message to everyone...'
                : 'Send private direct message...'
            }
            rows={2}
            className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none pr-10"
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition-all shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 hover:text-slate-200 transition-colors py-0.5"
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span className="text-[11px]">Attach File</span>
          </button>

          <span className="text-[10px] text-slate-500">
            Press Enter to send
          </span>
        </div>
      </div>
    </div>
  );
};
