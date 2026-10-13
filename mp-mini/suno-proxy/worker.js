// suno-proxy/worker.js
// Cloudflare Worker：Suno 第三方网关代理
// 设计要点：
//   - Suno 没有官方公开 API，需要走第三方网关（如 sunoapi.org）。
//   - API key 只能放在服务端，不能进浏览器；本 Worker 代持密钥，前端只认识 Worker 地址。
//   - 前端把提示词发到本 Worker，由 Worker 调网关生成、轮询、并把音频流代理回来（绕开浏览器跨域）。
//
// 部署步骤（你来做，约 5 分钟）：
//   1) 安装 wrangler：npm i -g wrangler  （或 npx wrangler）
//   2) 登录：wrangler login
//   3) 在 Cloudflare 控制台创建一个 Worker，把本文件内容粘贴进去；或本地 wrangler init 后覆盖 worker.js
//   4) 设置密钥（不是明文环境变量，用 Secret）：
//        wrangler secret put SUNO_API_KEY      # 你的第三方网关 API key
//        wrangler secret put SUNO_API_BASE     # 可选，默认 https://api.sunoapi.org
//   5) 部署：wrangler deploy
//   6) 把分配的地址（如 https://suno-proxy.<sub>.workers.dev）填进 App 的「🎚 用 Suno 创作」卡片。
//
// 前端只需知道本 Worker 的地址，密钥永不出现在浏览器/代码仓库。

// CORS：允许任意来源（只代理你自己的请求）。
// 想更严格可把 '*' 换成你的站点 origin，例如 https://eac029ed96e34158847012ede9c33d23.app.workbuddy.host
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(resp) {
  const h = new Headers(resp.headers);
  for (const k in CORS) h.set(k, CORS[k]);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// 不同第三方网关的响应结构略有差异，这里做归一化，方便前端统一处理。
function extractIds(genJson) {
  // sunoapi.org: { code, data:[{id, ...}] }
  const arr = genJson && (genJson.data || (genJson.data && genJson.data.data)) || [];
  return arr.map(x => x.id || x.song_id || x.clip_id).filter(Boolean);
}
function normalizeClips(getJson) {
  const arr = getJson && (getJson.data || (getJson.data && getJson.data.data)) || [];
  return arr.map(x => ({
    id: x.id,
    audioUrl: x.audio_url || x.audioUrl,
    title: x.title || '',
    status: x.status || '',
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const BASE = (env.SUNO_API_BASE || 'https://api.sunoapi.org').replace(/\/+$/, '');
    const KEY = env.SUNO_API_KEY || '';

    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
    if (!KEY) return withCors(json({ ok: false, error: 'SUNO_API_KEY 未配置：请在 Worker 里设置 Secret' }, 500));

    try {
      // 生成：把前端提示词转给网关
      if (url.pathname === '/generate' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const upstream = await fetch(BASE + '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
          body: JSON.stringify({
            prompt: body.prompt || '',
            custom_mode: false,
            instrumental: body.instrumental !== false,   // 默认纯音乐，更贴合本 App 场景
            model: body.model || 'chirp-v3-5',
            make_instrumental: body.instrumental !== false,
          }),
        });
        const j = await upstream.json().catch(() => ({}));
        const ids = extractIds(j);
        return withCors(json({ ok: ids.length > 0, ids, raw: j }));
      }

      // 轮询状态：返回已完成的音频地址
      if (url.pathname === '/status' && request.method === 'GET') {
        const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!ids.length) return withCors(json({ ok: false, error: '缺少 ids' }, 400));
        // 注意：sunoapi.org 的 /api/get 是 GET；若你的网关用 POST，请改成 fetch(...,{method:'POST',body:JSON.stringify({ids})})
        const upstream = await fetch(BASE + '/api/get?ids=' + encodeURIComponent(ids.join(',')), {
          headers: { 'Authorization': 'Bearer ' + KEY },
        });
        const j = await upstream.json().catch(() => ({}));
        const clips = normalizeClips(j);
        return withCors(json({ ok: true, clips }));
      }

      // 代理音频：避免前端直接拉 CDN 时的跨域问题
      if (url.pathname === '/audio') {
        const target = url.searchParams.get('u');
        if (!target) return withCors(json({ ok: false, error: '缺少 u' }, 400));
        const upstream = await fetch(target, { headers: { 'Authorization': 'Bearer ' + KEY } });
        const h = new Headers();
        h.set('Content-Type', upstream.headers.get('Content-Type') || 'audio/mpeg');
        const cl = upstream.headers.get('Content-Length');
        if (cl) h.set('Content-Length', cl);
        for (const k in CORS) h.set(k, CORS[k]);
        return new Response(upstream.body, { status: upstream.status, headers: h });
      }

      return withCors(json({ ok: false, error: '未知路径 ' + url.pathname }, 404));
    } catch (e) {
      return withCors(json({ ok: false, error: String((e && e.message) || e) }, 500));
    }
  },
};
