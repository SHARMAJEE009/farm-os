import { Injectable } from '@nestjs/common';
import * as https from 'https';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

@Injectable()
export class NewsService {
  private cache: { data: any; timestamp: number } | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  async getNews() {
    // Return cached result if fresh
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    const feeds = [
      'https://www.abc.net.au/news/topic/agriculture/rss.xml',
      'https://www.abc.net.au/news/topic/weather/rss.xml',
    ];

    const allItems: any[] = [];

    for (const feed of feeds) {
      try {
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}&count=10`;
        const result = await fetchJson(url);
        if (result.status === 'ok' && result.items) {
          const category = feed.includes('weather') ? 'Weather' : 'Agriculture';
          const items = result.items.map((item: any) => ({
            title: item.title,
            description: item.description
              ? item.description.replace(/<[^>]*>/g, '').substring(0, 200).trim() + '...'
              : '',
            url: item.link,
            pubDate: item.pubDate,
            author: item.author || result.feed?.title || 'ABC News',
            thumbnail: item.thumbnail || item.enclosure?.link || null,
            category,
            source: result.feed?.title || 'ABC News',
          }));
          allItems.push(...items);
        }
      } catch (err) {
        // Skip failed feeds silently
      }
    }

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const response = { items: allItems, count: allItems.length, cached_at: new Date().toISOString() };
    this.cache = { data: response, timestamp: Date.now() };
    return response;
  }
}

@ApiTags('news')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('news')
export class NewsController {
  constructor(private readonly service: NewsService) {}

  @Get()
  getNews() { return this.service.getNews(); }
}

@Module({ controllers: [NewsController], providers: [NewsService] })
export class NewsModule {}
