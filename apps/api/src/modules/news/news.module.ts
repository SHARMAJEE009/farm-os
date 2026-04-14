import { Injectable } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

// ── Raw fetch ────────────────────────────────────────────────────────────────
function fetchText(url: string): Promise<string> {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 FarmOS/1.0' } },
      (res) => {
        // Follow one redirect
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')); });
  });
}

// ── Minimal RSS parser ────────────────────────────────────────────────────────
function cdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}
function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? cdata(m[1]).replace(/<[^>]*>/g, '').trim() : '';
}
function attr(xml: string, tagName: string, attrName: string): string {
  const m = xml.match(new RegExp(`<${tagName}[^>]+${attrName}=["']([^"']+)["']`, 'i'));
  return m ? m[1] : '';
}

interface FeedItem {
  title: string;
  description: string;
  url: string;
  pubDate: string;
  thumbnail: string | null;
  category: string;
  source: string;
}

function parseRss(xml: string, category: string, sourceName: string): FeedItem[] {
  // Extract channel title
  const chanTitle = tag(xml.replace(/<item[\s\S]*/i, ''), 'title') || sourceName;

  // Split into item blocks
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return itemBlocks.map((block): FeedItem => {
    const title = tag(block, 'title');
    const link  = tag(block, 'link') || attr(block, 'link', 'href') || attr(block, 'guid', '');
    const rawDesc = tag(block, 'description') || tag(block, 'content:encoded') || '';
    const description = rawDesc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').substring(0, 220).trim() + (rawDesc.length > 220 ? '…' : '');
    const pubDate = tag(block, 'pubDate') || tag(block, 'dc:date') || new Date().toISOString();
    const thumbnail =
      attr(block, 'enclosure', 'url') ||
      attr(block, 'media:content', 'url') ||
      attr(block, 'media:thumbnail', 'url') ||
      block.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i)?.[0] ||
      null;

    return { title, description, url: link, pubDate, thumbnail, category, source: chanTitle || sourceName };
  }).filter(i => i.title && i.url);
}

// ── Feed registry ─────────────────────────────────────────────────────────────
const FEEDS = [
  { url: 'https://www.theland.com.au/rss.xml',    category: 'Agriculture', source: 'The Land' },
  { url: 'https://www.farmweekly.com.au/rss.xml', category: 'Agriculture', source: 'Farm Weekly' },
];

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class NewsService {
  private cache: { data: any; timestamp: number } | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000;

  async getNews() {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const xml = await fetchText(feed.url);
        return parseRss(xml, feed.category, feed.source);
      }),
    );

    const allItems: FeedItem[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled') allItems.push(...r.value);
    });

    // Deduplicate by URL, sort newest first
    const seen = new Set<string>();
    const unique = allItems.filter((i) => {
      if (!i.url || seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    });
    unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const response = { items: unique, count: unique.length, cached_at: new Date().toISOString() };
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
