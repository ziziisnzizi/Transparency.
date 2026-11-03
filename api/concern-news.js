import { CONCERN_TOPICS, getConcernTopic } from '../lib/concern-topics.js';
import { getConcernNewsSources } from '../lib/concern-news-sources.js';

export const MAX_NEWS_REQUEST_BYTES = 2048;
export const MAX_CONCERN_ARTICLES = 5;

const header = (req, name) => {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : '';
};

function sameOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin) return true;
  try {
    const host = header(req, 'host');
    const protocol = header(req, 'x-forwarded-proto').split(',')[0].trim() || (req.socket?.encrypted ? 'https' : 'http');
    return Boolean(host) && ['https', 'http'].includes(protocol) && new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch { return false; }
}

function send(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

function publicHttps(value) {
  if (typeof value !== 'string' || value.length > 3000 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.')
      || host.endsWith('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')
      || /^[\d.]+$/.test(host) || host.includes(':') || !/^[a-z0-9.-]+$/.test(host)) return null;
    return url;
  } catch { return null; }
}

function validDate(value, nullable = false) {
  if (nullable && value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && Number.isFinite(Date.parse(value));
}

function plainText(value, limit) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function safeArticles(records, topicId) {
  if (!Array.isArray(records)) return [];
  const ids = new Set();
  const urls = new Set();
  const articles = [];
  for (const item of records.slice(0, 100)) {
    if (!item || !Array.isArray(item.topics) || !item.topics.includes(topicId)
      || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(item.id || '') || ids.has(item.id)
      || !plainText(item.title, 500) || !plainText(item.sourceName, 160)
      || !['news', 'guide'].includes(item.kind) || !validDate(item.publishedAt, true) || !validDate(item.checkedAt)) continue;
    const url = publicHttps(item.url);
    const sourceUrl = publicHttps(item.sourceUrl);
    if (!url || !sourceUrl || urls.has(url.href)) continue;
    const publisher = sourceUrl.hostname.replace(/^www\./, '');
    const articleHost = url.hostname.replace(/^www\./, '');
    if (articleHost !== publisher && !articleHost.endsWith(`.${publisher}`)) continue;
    ids.add(item.id);
    urls.add(url.href);
    articles.push({
      id: item.id, title: item.title.trim(), sourceName: item.sourceName.trim(),
      sourceUrl: sourceUrl.href, url: url.href, publishedAt: item.publishedAt,
      kind: item.kind, checkedAt: item.checkedAt,
    });
    if (articles.length === MAX_CONCERN_ARTICLES) break;
  }
  return articles;
}

function searchUrlFor(topic) {
  const url = new URL('https://news.google.com/search');
  url.searchParams.set('hl', 'ko');
  url.searchParams.set('gl', 'KR');
  url.searchParams.set('ceid', 'KR:ko');
  url.searchParams.set('q', topic.newsQuery);
  return url.href;
}

// The catalog contains reviewed publisher links. This endpoint neither scrapes
// a news feed nor forwards a question or review to an external search service.
export function createConcernNewsHandler({ getSources = getConcernNewsSources, now = Date.now, rateLimit = 30, rateWindowMs = 60000 } = {}) {
  const buckets = new Map();
  return async function concernNews(req, res) {
    try {
      if (!sameOrigin(req)) return send(res, 403, { error: '같은 사이트에서 자료를 확인해 주세요.' });
      if (req.method !== 'GET') return send(res, 405, { error: 'GET 요청만 지원합니다.' }, { Allow: 'GET' });
      if (typeof req.url !== 'string' || Buffer.byteLength(req.url, 'utf8') > MAX_NEWS_REQUEST_BYTES) return send(res, 414, { error: '요청 주소가 너무 깁니다.' });
      const length = header(req, 'content-length');
      if ((length && !/^0+$/.test(length)) || header(req, 'transfer-encoding') || (req.body !== undefined && req.body !== null && req.body !== '')) return send(res, 400, { error: '주제 식별자만 요청해 주세요.' });
      let url;
      try { url = new URL(req.url, 'https://concern-news.invalid'); }
      catch { return send(res, 400, { error: '요청 주소를 확인해 주세요.' }); }
      const queryKeys = [...url.searchParams.keys()];
      if (queryKeys.length !== 1 || queryKeys[0] !== 'topic') return send(res, 400, { error: '허용된 주제 식별자만 요청해 주세요.' });
      const topicId = url.searchParams.get('topic');
      const topic = getConcernTopic(topicId);
      if (!topic || !CONCERN_TOPICS.some(item => item.id === topicId)) return send(res, 400, { error: '확인할 주제를 선택해 주세요.' });

      const time = now();
      for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
      const address = (header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket?.remoteAddress || 'anonymous').slice(0, 128);
      const current = buckets.get(address) || { count: 0, expires: time + rateWindowMs };
      if (current.count >= rateLimit || (!buckets.has(address) && buckets.size >= 2000)) return send(res, 429, { error: '요청이 많습니다. 잠시 후 다시 확인해 주세요.' }, { 'Retry-After': String(Math.max(1, Math.ceil((current.expires - time) / 1000))) });
      current.count++;
      buckets.set(address, current);

      let records;
      try { records = getSources(topic.id); } catch { records = []; }
      const articles = safeArticles(records, topic.id);
      const checkedAt = articles.length ? articles.map(item => item.checkedAt).sort()[0] : null;
      return send(res, 200, {
        topic: topic.id, status: articles.length ? 'curated' : 'unavailable', articles, checkedAt,
        searchUrl: searchUrlFor(topic),
        notice: articles.length
          ? '실시간 뉴스가 아닌, 출처를 확인한 기사·기관 안내입니다. 발행일이 확인되지 않은 자료는 날짜를 표시하지 않습니다.'
          : '이 주제에서 확인한 기사·기관 안내가 없습니다. 외부 뉴스 검색에서 자료를 확인할 수 있습니다.',
      });
    } catch {
      return send(res, 500, { error: '자료를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  };
}

export default createConcernNewsHandler();
