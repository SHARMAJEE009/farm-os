import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class WeatherService {
  constructor(
    @Inject(DATABASE_POOL) private db: Pool,
    private configService: ConfigService
  ) {}

  async getWeather(farmId: string) {
    // Check cache first (valid for 30 minutes)
    const { rows: cached } = await this.db.query(
      `SELECT * FROM weather_cache 
       WHERE farm_id = $1 AND fetched_at > NOW() - INTERVAL '30 minutes'
       ORDER BY fetched_at DESC LIMIT 1`,
      [farmId],
    );
    if (cached[0]) {
      return {
        current: cached[0].current_data,
        forecast: cached[0].forecast_data,
        location: cached[0].location_name,
        cached_at: cached[0].fetched_at,
      };
    }

    // Get farm coords
    const { rows: farms } = await this.db.query(
      `SELECT f.name, p.latitude, p.longitude
       FROM farms f
       LEFT JOIN paddocks p ON p.farm_id = f.id AND p.latitude IS NOT NULL
       WHERE f.id = $1 LIMIT 1`,
      [farmId],
    );

    const lat = farms[0]?.latitude ?? -31.95;
    const lng = farms[0]?.longitude ?? 115.86;
    const farmName = farms[0]?.name ?? 'Farm';

    // Generate realistic mock weather data (replace with real API call when key is added)
    const current = this.generateCurrentWeather();
    const forecast = this.generateForecast();

    // Cache it
    await this.db.query(
      `INSERT INTO weather_cache (farm_id, current_data, forecast_data, location_name, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [farmId, JSON.stringify(current), JSON.stringify(forecast), farmName, lat, lng],
    );

    return { current, forecast, location: farmName, cached_at: new Date() };
  }

  async getSprayConditions(farmId: string) {
    const weather = await this.getWeather(farmId);
    const c = weather.current;
    
    const windOk = c.wind_speed_kmh <= 15;
    const tempOk = c.temperature_c >= 10 && c.temperature_c <= 30;
    const deltaT = c.temperature_c - c.dew_point_c;
    const deltaTOk = deltaT >= 2 && deltaT <= 8;
    const humidityOk = c.humidity_pct >= 40 && c.humidity_pct <= 90;
    const rainOk = c.rain_mm_1h === 0;

    const suitable = windOk && tempOk && deltaTOk && humidityOk && rainOk;

    return {
      suitable,
      conditions: {
        wind: { value: c.wind_speed_kmh, unit: 'km/h', ok: windOk, limit: '≤15 km/h' },
        temperature: { value: c.temperature_c, unit: '°C', ok: tempOk, limit: '10–30°C' },
        delta_t: { value: parseFloat(deltaT.toFixed(1)), unit: '°C', ok: deltaTOk, limit: '2–8°C' },
        humidity: { value: c.humidity_pct, unit: '%', ok: humidityOk, limit: '40–90%' },
        rain: { value: c.rain_mm_1h, unit: 'mm', ok: rainOk, limit: '0 mm' },
      },
      recommendation: suitable
        ? 'Conditions are suitable for spraying.'
        : 'Conditions are NOT ideal for spraying. Check individual parameters.',
    };
  }

  private generateCurrentWeather() {
    const temp = 15 + Math.random() * 15;
    const humidity = 40 + Math.random() * 40;
    const wind = 5 + Math.random() * 20;
    return {
      temperature_c: parseFloat(temp.toFixed(1)),
      feels_like_c: parseFloat((temp - 2 + Math.random() * 4).toFixed(1)),
      humidity_pct: Math.round(humidity),
      wind_speed_kmh: parseFloat(wind.toFixed(1)),
      wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
      pressure_hpa: Math.round(1010 + Math.random() * 20),
      uv_index: parseFloat((1 + Math.random() * 8).toFixed(1)),
      cloud_cover_pct: Math.round(Math.random() * 80),
      rain_mm_1h: Math.random() > 0.7 ? parseFloat((Math.random() * 5).toFixed(1)) : 0,
      dew_point_c: parseFloat((temp - 5 - Math.random() * 8).toFixed(1)),
      description: ['Clear sky', 'Partly cloudy', 'Overcast', 'Light breeze', 'Sunny'][Math.floor(Math.random() * 5)],
      icon: ['☀️', '⛅', '☁️', '🌤️', '🌥️'][Math.floor(Math.random() * 5)],
    };
  }

  private generateForecast() {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const high = 18 + Math.random() * 15;
      days.push({
        date: d.toISOString().split('T')[0],
        day: dayNames[d.getDay()],
        high_c: parseFloat(high.toFixed(1)),
        low_c: parseFloat((high - 5 - Math.random() * 5).toFixed(1)),
        rain_chance_pct: Math.round(Math.random() * 60),
        rain_mm: parseFloat((Math.random() > 0.5 ? Math.random() * 10 : 0).toFixed(1)),
        wind_kmh: parseFloat((5 + Math.random() * 20).toFixed(1)),
        description: ['Sunny', 'Partly cloudy', 'Cloudy', 'Showers', 'Clear'][Math.floor(Math.random() * 5)],
        icon: ['☀️', '⛅', '☁️', '🌧️', '🌤️'][Math.floor(Math.random() * 5)],
      });
    }
    return days;
  }
}
