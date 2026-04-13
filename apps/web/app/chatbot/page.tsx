'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Bot, User, MessageSquare, Tractor } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ChatMessage } from '@/types';

const SUGGESTED = [
  "What are my total costs?",
  "Give me a farm overview",
  "Which paddock costs the most?",
  "How many staff hours logged?",
  "Show me fuel usage summary",
  "Any pending recommendations?",
  "Summarise supplier orders",
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "G'day! I'm your Farm OS assistant. I have access to all your farm data — costs, paddocks, staff, fuel, supplier orders, and recommendations.\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const mutation = useMutation({
    mutationFn: (message: string) => api.post('/chatbot', { message }).then(r => r.data),
    onMutate: () => setIsTyping(true),
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      }]);
    },
    onError: () => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble getting that information. Please try again.',
        timestamp: new Date(),
      }]);
    },
  });

  function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    mutation.mutate(text.trim());
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function formatContent(content: string) {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
      }
      // Handle inline bold
      const parts = line.split(/(\*\*[^*]+\*\*)/);
      return (
        <p key={i} className={line === '' ? 'mb-1' : ''}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    });
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 h-full flex flex-col" style={{ minHeight: 'calc(100vh - 0px)' }}>
        <PageHeader
          title="AI Assistant"
          subtitle="Ask questions about your farm data in plain English"
        />

        <div className="flex gap-6 flex-1 min-h-0">
          {/* Suggested questions panel */}
          <div className="hidden lg:flex flex-col w-56 flex-shrink-0 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-farm-600" />
                <p className="text-sm font-semibold text-gray-700">Try asking…</p>
              </div>
              <div className="space-y-1.5">
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={mutation.isPending}
                    className="w-full text-left text-xs text-gray-600 hover:text-farm-700 hover:bg-farm-50 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-4 bg-farm-50 border-farm-100">
              <div className="flex items-center gap-2 mb-2">
                <Tractor className="w-4 h-4 text-farm-600" />
                <p className="text-xs font-semibold text-farm-700">Farm OS Assistant</p>
              </div>
              <p className="text-xs text-farm-600 leading-relaxed">
                I pull live data from your farm database to give you accurate, up-to-date answers.
              </p>
            </div>
          </div>

          {/* Chat panel */}
          <div className="flex-1 flex flex-col card p-0 overflow-hidden min-h-[500px]">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'assistant' ? 'bg-farm-100' : 'bg-gray-200'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot className="w-4 h-4 text-farm-700" />
                      : <User className="w-4 h-4 text-gray-600" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm'
                      : 'bg-farm-600 text-white rounded-tr-sm'
                  }`}>
                    <div className="space-y-0.5">
                      {formatContent(msg.content)}
                    </div>
                    <p className={`text-xs mt-1.5 ${msg.role === 'assistant' ? 'text-gray-400' : 'text-farm-200'}`}>
                      {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-farm-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-farm-700" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gray-100 p-4">
              {/* Mobile suggested questions */}
              <div className="lg:hidden flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                {SUGGESTED.slice(0, 4).map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={mutation.isPending}
                    className="flex-shrink-0 text-xs bg-gray-100 hover:bg-farm-50 hover:text-farm-700 text-gray-600 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about costs, paddocks, staff, orders…"
                  disabled={mutation.isPending}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-500 focus:border-transparent"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={mutation.isPending || !input.trim()}
                  className="w-10 h-10 bg-farm-600 hover:bg-farm-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
