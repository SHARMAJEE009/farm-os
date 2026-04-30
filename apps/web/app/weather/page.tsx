'use client';

import { useQuery } from '@tanstack/react-query';
import { CloudSun, Wind, Droplets, Thermometer, Sun, Eye, Gauge, CloudRain, Sprout } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useFarm } from '@/lib/farm-context';
import type { WeatherData, SprayConditions } from '@/types';
import AppLayout from '@/components/layout/AppLayout';

function ConditionBadge({ ok, label, value, unit, limit }: { ok: boolean; label: string; value: number; unit: string; limit: string }) {
  return (
    <div className={`rounded-xl border p-4 ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600 uppercase">{label}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      <p className={`text-2xl font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>{value}{unit}</p>
      <p className="text-xs text-gray-400 mt-0.5">Ideal: {limit}</p>
    </div>
  );
}

export default function WeatherPage() {
  const { activeFarmId } = useFarm();

  const { data: weather, isLoading: wLoading } = useQuery<WeatherData>({
    queryKey: ['weather', activeFarmId],
    queryFn: () => api.get('/weather', { params: { farm_id: activeFarmId } }).then(r => r.data),
    enabled: !!activeFarmId,
  });

  const { data: spray, isLoading: sLoading } = useQuery<SprayConditions>({
    queryKey: ['spray-conditions', activeFarmId],
    queryFn: () => api.get('/weather/spray-conditions', { params: { farm_id: activeFarmId } }).then(r => r.data),
    enabled: !!activeFarmId,
  });

  const isLoading = wLoading || sLoading;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          title="Weather & Spray Conditions"
          subtitle={weather ? `${weather.location} — updated ${new Date(weather.cached_at).toLocaleTimeString()}` : 'Real-time weather for your farm location'}
        />

        {isLoading ? <Spinner /> : !weather ? (
          <div className="card p-8 text-center text-gray-400">No weather data available. Ensure your farm has paddock coordinates.</div>
        ) : (
          <div className="space-y-6">
            {/* Current Weather */}
            <div className="card p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-6xl">{weather.current.icon}</div>
                <div>
                  <p className="text-5xl font-bold text-gray-900">{weather.current.temperature_c}°C</p>
                  <p className="text-sm text-gray-500 mt-1">Feels like {weather.current.feels_like_c}°C · {weather.current.description}</p>
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 ml-auto">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{weather.current.wind_speed_kmh} km/h</p>
                      <p className="text-xs text-gray-400">{weather.current.wind_direction}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{weather.current.humidity_pct}%</p>
                      <p className="text-xs text-gray-400">Humidity</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{weather.current.pressure_hpa} hPa</p>
                      <p className="text-xs text-gray-400">Pressure</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{weather.current.uv_index}</p>
                      <p className="text-xs text-gray-400">UV Index</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spray Conditions */}
            {spray && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Sprout className="w-5 h-5 text-farm-600" />
                  <h2 className="text-lg font-bold text-gray-900">Spray Conditions</h2>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${spray.suitable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {spray.suitable ? '✓ Suitable for spraying' : '✗ Not ideal for spraying'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(spray.conditions).map(([key, cond]) => (
                    <ConditionBadge key={key} ok={cond.ok} label={key.replace('_', ' ')} value={cond.value} unit={cond.unit} limit={cond.limit} />
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-3 italic">{spray.recommendation}</p>
              </div>
            )}

            {/* 7-Day Forecast */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">7-Day Forecast</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {weather.forecast.map((day, i) => (
                  <div key={day.date} className={`card p-4 text-center ${i === 0 ? 'bg-farm-50 border-farm-200' : ''}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase">{i === 0 ? 'Today' : day.day}</p>
                    <p className="text-3xl my-2">{day.icon}</p>
                    <div className="flex items-center justify-center gap-1.5 text-sm">
                      <span className="font-bold text-gray-900">{day.high_c}°</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-400">{day.low_c}°</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{day.description}</p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-blue-500">
                      <CloudRain className="w-3 h-3" />
                      {day.rain_chance_pct}%
                      {day.rain_mm > 0 && <span className="text-gray-400 ml-1">({day.rain_mm}mm)</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                      <Wind className="w-3 h-3" /> {day.wind_kmh} km/h
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
