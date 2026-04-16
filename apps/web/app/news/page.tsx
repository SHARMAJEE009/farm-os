'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFarm } from '@/lib/farm-context';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Newspaper, ExternalLink, RefreshCw, Search, Clock, Cloud, Wind, Droplets, Thermometer, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NewsResponse, NewsItem, Paddock } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const AGRO_API_KEY = '587b1967699157991ef25e887b576015';

const CROP_EMOJI: Record<string, string> = {
  Wheat: '🌾', Barley: '🌾', Canola: '🌼', Corn: '🌽', Soybeans: '🫘',
  Sorghum: '🌿', Cotton: '🤍', Sunflower: '🌻', Oats: '🌾', Rice: '🍚',
  Chickpeas: '🫘', Lentils: '🫘', Potatoes: '🥔', Lucerne: '🌿', Other: '🌱',
};

const CATEGORIES = ["Agriculture", "Paddock's Weather"];

const CATEGORY_COLORS: Record<string, string> = {
  Agriculture:         'bg-farm-100 text-farm-700',
  "Paddock's Weather": 'bg-sky-100 text-sky-700',
};

// Wind degree to compass direction
function windDir(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

interface AgroWeather {
  dt: number;
  weather: { id: number; main: string; description: string; icon: string }[];
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  wind: { speed: number; deg: number };
  clouds: { all: number };
}

async function fetchWeather(lat: number, lon: number): Promise<AgroWeather> {
  const url = `https://api.agromonitoring.com/agro/1.0/weather?lat=${lat}&lon=${lon}&units=metric&appid=${AGRO_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error ${res.status}`);
  const data = await res.json();
  // API returns an array; take the first item
  return Array.isArray(data) ? data[0] : data;
}

function WeatherCard({ paddock, weather, isLoading, isError }: {
  paddock: Paddock;
  weather?: AgroWeather;
  isLoading: boolean;
  isError: boolean;
}) {
  const w = weather?.weather?.[0];
  const cropEmoji = paddock.crop_type ? (CROP_EMOJI[paddock.crop_type] ?? '🌱') : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">

      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 px-5 pt-5 pb-8 text-white">
        {/* Crop badge top-right */}
        {cropEmoji && (
          <div className="absolute top-4 right-4 flex flex-col items-center gap-0.5">
            <span className="text-3xl leading-none">{cropEmoji}</span>
            <span className="text-[10px] text-blue-100 font-medium">{paddock.crop_type}</span>
          </div>
        )}

        {/* Paddock name */}
        <h3 className="font-bold text-lg leading-tight pr-16">{paddock.name}</h3>
        <p className="text-blue-200 text-xs mt-0.5">
          {paddock.latitude?.toFixed(4)}°, {paddock.longitude?.toFixed(4)}°
        </p>

        {/* Temperature */}
        {isLoading && (
          <div className="mt-4 flex items-center gap-2 text-blue-100 text-sm">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
            Loading weather…
          </div>
        )}
        {!isLoading && isError && (
          <div className="mt-4 flex items-center gap-1.5 text-blue-100 text-sm">
            <AlertCircle className="w-4 h-4" /> Could not load weather
          </div>
        )}
        {!isLoading && !isError && weather && (
          <div className="mt-3 flex items-end gap-3">
            <span className="text-5xl font-bold tracking-tight">{Math.round(weather.main.temp)}°</span>
            <div className="mb-1">
              <p className="text-blue-100 text-sm capitalize">{w?.description ?? ''}</p>
              <p className="text-blue-200 text-xs">Feels like {Math.round(weather.main.feels_like)}°C</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      {!isLoading && !isError && weather && (
        <>
          <div className="grid grid-cols-3 divide-x divide-gray-100 -mt-4 mx-4 bg-white rounded-xl border border-gray-100 shadow-md z-10">
            <div className="flex flex-col items-center py-3 gap-0.5">
              <Droplets className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-gray-800">{weather.main.humidity}%</span>
              <span className="text-[11px] text-gray-400">Humidity</span>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <Wind className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-gray-800">{weather.wind.speed} m/s</span>
              <span className="text-[11px] text-gray-400">{windDir(weather.wind.deg)}</span>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <Cloud className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-bold text-gray-800">{weather.clouds.all}%</span>
              <span className="text-[11px] text-gray-400">Cloud</span>
            </div>
          </div>

          {/* ── Min / Max / Pressure ── */}
          <div className="flex items-center justify-between px-5 py-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-blue-400" />
              {Math.round(weather.main.temp_min)}° min
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-red-400" />
              {Math.round(weather.main.temp_max)}° max
            </span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="text-gray-400">{weather.main.pressure} hPa</span>
          </div>
        </>
      )}

      {/* spacer when loading/error so cards have consistent height */}
      {(isLoading || isError) && <div className="flex-1 min-h-[80px]" />}
    </div>
  );
}

function WeatherSection() {
  const { activeFarmId } = useFarm();
  const farmParams = activeFarmId ? { farm_id: activeFarmId } : {};

  const { data: paddocks, isLoading: paddocksLoading } = useQuery<Paddock[]>({
    queryKey: ['paddocks', activeFarmId],
    queryFn: () => api.get('/paddocks', { params: farmParams }).then(r => r.data),
  });

  const paddocksWithCoords = (paddocks ?? []).filter(
    p => p.latitude != null && p.longitude != null
  );

  const weatherResults = useQueries({
    queries: paddocksWithCoords.map(p => ({
      queryKey: ['weather', p.id, p.latitude, p.longitude],
      queryFn: () => fetchWeather(p.latitude!, p.longitude!),
      staleTime: 10 * 60 * 1000, // 10 min cache
      retry: 1,
    })),
  });

  if (paddocksLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (paddocksWithCoords.length === 0) {
    return (
      <EmptyState
        icon={Cloud}
        title="No paddock coordinates"
        description="Add latitude and longitude to your paddocks to see weather data."
      />
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-5">
        Live conditions for {paddocksWithCoords.length} paddock{paddocksWithCoords.length !== 1 ? 's' : ''} · updated every 10 min
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {paddocksWithCoords.map((p, i) => (
          <WeatherCard
            key={p.id}
            paddock={p}
            weather={weatherResults[i]?.data}
            isLoading={weatherResults[i]?.isLoading ?? true}
            isError={weatherResults[i]?.isError ?? false}
          />
        ))}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const [timeAgo, setTimeAgo] = useState('');
  useEffect(() => {
    try { setTimeAgo(formatDistanceToNow(new Date(item.pubDate), { addSuffix: true })); }
    catch { setTimeAgo(item.pubDate); }
  }, [item.pubDate]);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-farm-200 transition-all duration-200 overflow-hidden"
    >
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
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {item.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-farm-700 transition-colors leading-snug">
          {item.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-3 flex-1 leading-relaxed">
          {item.description}
        </p>
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
  const [category, setCategory] = useState('Agriculture');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<NewsResponse>({
    queryKey: ['news'],
    queryFn: () => api.get('/news').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    let items = data?.items ?? [];
    items = items.filter(i => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, category, search]);

  const showWeatherSection = category === "Paddock's Weather";

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
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
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto w-fit max-w-full">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => { setCategory(c); setSearch(''); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {!showWeatherSection && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search news…"
                className="input pl-9"
              />
            </div>
          )}
        </div>

        {/* Weather tab */}
        {showWeatherSection ? (
          <WeatherSection />
        ) : isLoading ? (
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
