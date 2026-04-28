'use client';

import { useState, useRef, useEffect } from 'react';
import { useFarm } from '@/lib/farm-context';
import { getRole } from '@/lib/role';
import { Send, Bot, User, Sparkles, MessageSquare, AlertCircle, TrendingUp, ShoppingCart, Users } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/utils';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AiAssistantPage() {
  const { activeFarmId } = useFarm();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('staff');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRole(getRole());
  }, []);

  const suggestions = [
    { text: "What are my total costs this month?", icon: TrendingUp, roles: ['owner', 'manager'] },
    { text: "Which paddock costs the most per hectare?", icon: AlertCircle, roles: ['owner', 'manager', 'agronomist'] },
    { text: "Are there any pending recommendations?", icon: MessageSquare, roles: ['owner', 'manager', 'agronomist', 'staff'] },
    { text: "How many head do I have on farm?", icon: Users, roles: ['owner', 'manager', 'staff'] },
    { text: "Are there any health alerts?", icon: AlertCircle, roles: ['owner', 'manager', 'staff'] },
    { text: "How many pending orders do I have?", icon: ShoppingCart, roles: ['owner', 'manager', 'supplier'] },
  ].filter(s => s.roles.includes(role));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || !activeFarmId) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chat', {
        message: text,
        farm_id: activeFarmId
      });

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I encountered an error. Please check your API configuration and try again." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        <div className="p-4 sm:p-6 border-b bg-white">
          <PageHeader
            title="AI Assistant"
            subtitle="Ask questions about your farm data and get instant insights"
            icon={<Sparkles className="w-6 h-6 text-farm-600" />}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center">
              <div className="w-16 h-16 bg-farm-50 rounded-2xl flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-farm-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
              <p className="text-gray-500 mb-8">
                I'm your intelligent farming companion. I can help you analyze costs, check livestock health, 
                and keep track of paddock activities. Try asking one of the suggestions below.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.text)}
                    className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-farm-300 hover:shadow-md transition-all text-left group"
                  >
                    <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-farm-50 transition-colors">
                      <s.icon className="w-5 h-5 text-gray-400 group-hover:text-farm-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      m.role === 'user' ? 'bg-farm-600 text-white' : 'bg-white border text-farm-600'
                    }`}>
                      {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`p-4 rounded-2xl shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-farm-600 text-white rounded-tr-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {m.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center">
                      <Bot className="w-5 h-5 text-farm-600" />
                    </div>
                    <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 bg-white border-t">
          <div className="max-w-4xl mx-auto">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your farm..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-farm-500 transition-all text-gray-900 placeholder-gray-400"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 p-3 bg-farm-600 text-white rounded-xl hover:bg-farm-700 disabled:opacity-50 disabled:hover:bg-farm-600 transition-all shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              AI-generated responses. Always verify critical data before making operational decisions.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
