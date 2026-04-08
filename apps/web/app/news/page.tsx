'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, ExternalLink, RefreshCw, Search, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NewsResponse, NewsItem } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const CATEGORIES = ['All', 'Agriculture', 'Weather'];

const CATEGORY_COLORS: Record<string, string> = {
  Agriculture: 'bg-farm-100 text-farm-700',
  Weather: 'bg-blue-100 text-blue-700',
};

function NewsCard({ item }: { item: NewsItem }) {
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(item.pubDate), { addSuffix: true }); }
    catch { return item.pubDate; }
  })();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-farm-200 transition-all duration-200 overflow-hidden"
    >
      {/* Thumbnail */}
      {item.thumbnail ? (
        <div className="h-40 overflow-hidden bg-gray-100">
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-br from-farm-50 to-farm-100 flex items-center justify-center">
          <Newspaper className="w-10 h-10 text-farm-300" />
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        {/* Category + time */}
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {item.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-farm-700 transition-colors leading-snug">
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-500 line-clamp-3 flex-1 leading-relaxed">
          {item.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400 truncate">{item.source}</span>
          <span className="flex items-center gap-1 text-xs text-farm-600 font-medium group-hover:text-farm-700">
            Read more
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<NewsResponse>({
    queryKey: ['news'],
    queryFn: () => api.get('/news').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    let items = data?.items ?? [];
    if (category !== 'All') items = items.filter(i => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, category, search]);

  return (
    <AppLayout>
      <div className="p-6">
        <PageHeader
          title="News"
          subtitle="Latest Australian agriculture and weather news"
          action={
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Category tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search news…"
              className="input pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          search || category !== 'All'
            ? <div className="text-center py-16 text-gray-400">No articles match your filters.</div>
            : <EmptyState icon={Newspaper} title="No news available" description="Could not load news feed. Check your connection and try refreshing." action={<button onClick={() => refetch()} className="btn-primary">Try again</button>} />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{filtered.length} articles</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item, i) => (
                <NewsCard key={`${item.url}-${i}`} item={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
