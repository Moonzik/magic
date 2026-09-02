// 主应用逻辑
(function () {
  'use strict';

  // ===== 本地存储 =====
  const STORE_KEY = 'xinnian_mvp';
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { wishes: [], savedAffirmations: [], checkedIn: {} };
  }
  function saveStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  let store = loadStore();

  // ===== 工具 =====
  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  // ===== 今日肯定语（根据愿望生成；无愿望时用通用库）=====
  function getTodayTip() {
    const seed = seedFromDate(todayStr()) >> 3;
    return TIPS[seed % TIPS.length];
  }
  function cleanWish(s) {
    return String(s).replace(/[。！？!?，,、\s]+$/g, '');
  }
  function lightWish(s) {
    return String(s)
      .replace(/^(我希望|我想要|我想|我要|我期待|我渴望|我盼着|我许愿|希望)/, '')
      .replace(/^(能|可以|能够|早点|尽快)/, '')
      .replace(/^\s+|\s+$/g, '');
  }
  function getWishPool(cat) {
    return AFFIRMATIONS_BY_CAT[cat] || AFFIRMATIONS;
  }
  function makeWishAffirmation(wish, idx) {
    const pool = getWishPool(wish.cat);
    const cleaned = cleanWish(wish.text);
    const w = lightWish(cleaned) || cleaned;
    return pool[idx % pool.length].replace(/\{wish\}/g, w);
  }
  // 肯定语状态：mode = 'wish'（根据某个愿望生成）或 'generic'（通用库）
  let affState = { mode: 'generic', wishIdx: 0, poolIdx: 0 };
  function computeAffirmation() {
    const seed = seedFromDate(todayStr());
    if (store.wishes.length > 0) {
      const wishIdx = seed % store.wishes.length;
      affState = { mode: 'wish', wishIdx, poolIdx: seed % getWishPool(store.wishes[wishIdx].cat).length };
    } else {
      affState = { mode: 'generic', wishIdx: 0, poolIdx: seed % AFFIRMATIONS.length };
    }
  }
  function renderAffirmation() {
    const textEl = document.getElementById('affirmationText');
    const srcEl = document.getElementById('affirmationSource');
    if (affState.mode === 'wish' && store.wishes[affState.wishIdx]) {
      const wish = store.wishes[affState.wishIdx];
      textEl.textContent = makeWishAffirmation(wish, affState.poolIdx);
      srcEl.textContent = '✨ 为你的心愿「' + wish.text + '」定制';
      srcEl.style.display = 'block';
    } else {
      textEl.textContent = AFFIRMATIONS[affState.poolIdx % AFFIRMATIONS.length];
      srcEl.style.display = 'none';
    }
  }

  // ===== 页面导航 =====
  const pages = { home: 'page-home', wish: 'page-wish', music: 'page-music', tarot: 'page-tarot', fate: 'page-fate' };
  function navigate(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pages[pageId]).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.nav === pageId));
    if (pageId === 'home') { computeAffirmation(); renderAffirmation(); }
    if (pageId === 'wish') { renderWishes(); }
    if (pageId === 'tarot') { resetTarot(); }
    if (pageId === 'fate') {
      const fd = document.getElementById('fateDate');
      if (fd && !fd.value) {
        const t = new Date();
        fd.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      }
    }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // ===== 首页渲染 =====
  function renderHome() {
    renderAffirmation();
    document.getElementById('tipText').textContent = getTodayTip();
    const d = new Date();
    const week = ['日','一','二','三','四','五','六'][d.getDay()];
    document.getElementById('todayLabel').textContent = `${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`;
  }

  document.getElementById('refreshAffirmation').addEventListener('click', () => {
    if (affState.mode === 'wish' && store.wishes.length > 0) {
      const wish = store.wishes[affState.wishIdx];
      const pool = getWishPool(wish.cat);
      affState.poolIdx += 1;
      if (affState.poolIdx >= pool.length) {
        affState.poolIdx = 0;
        affState.wishIdx = (affState.wishIdx + 1) % store.wishes.length;
      }
    } else {
      affState.poolIdx = (affState.poolIdx + 1) % AFFIRMATIONS.length;
    }
    renderAffirmation();
    toast('已换一条 ✨');
  });
  document.getElementById('saveAffirmation').addEventListener('click', () => {
    const text = document.getElementById('affirmationText').textContent;
    if (!store.savedAffirmations.includes(text)) {
      store.savedAffirmations.push(text);
      saveStore(store);
      toast('已收藏 💗');
    } else {
      toast('这条已经收藏过啦');
    }
  });

  // ===== 许愿模块 =====
  function renderWishes() {
    const list = document.getElementById('wishList');
    const empty = document.getElementById('wishEmpty');
    list.innerHTML = '';
    if (store.wishes.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    store.wishes.forEach((w, idx) => {
      const checks = Object.keys(w.checks || {}).length;
      const totalDays = w.createdAt ? Math.max(1, Math.floor((Date.now() - new Date(w.createdAt).getTime()) / 86400000) + 1) : 1;
      const pct = Math.min(100, Math.round((checks / 21) * 100)); // 以 21 天为一个显化周期
      const div = document.createElement('div');
      div.className = 'wish-item';
      div.innerHTML = `
        <div class="wish-item-top">
          <span class="wish-item-text">${escapeHtml(w.text)}</span>
          <span class="wish-item-cat">${escapeHtml(w.cat)}</span>
        </div>
        <div class="wish-item-meta">${w.deadline ? '期限 ' + fmtDate(w.deadline) + ' · ' : ''}已坚持 ${checks} 天</div>
        <div class="wish-progress">
          <div class="wish-progress-bar"><div class="wish-progress-fill" style="width:${pct}%"></div></div>
          <div class="wish-progress-label">显化进度 ${pct}%（21 天周期）</div>
        </div>
        <div class="wish-item-actions">
          <button class="btn btn-primary btn-sm" data-check="${idx}">${w.checks[todayStr()] ? '今日已打卡 ✓' : '今日打卡'}</button>
          <button class="btn btn-danger btn-sm" data-del="${idx}">删除</button>
        </div>`;
      list.appendChild(div);
    });
    list.querySelectorAll('[data-check]').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = store.wishes[+btn.dataset.check];
        w.checks = w.checks || {};
        if (!w.checks[todayStr()]) {
          w.checks[todayStr()] = true;
          saveStore(store);
          toast('打卡成功，愿望在显化中 ✨');
        } else {
          toast('今天已经打过卡啦');
        }
        renderWishes();
      });
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定删除这个愿望吗？')) {
          store.wishes.splice(+btn.dataset.del, 1);
          saveStore(store);
          renderWishes();
          toast('已删除');
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // 许愿弹窗
  const wishModal = document.getElementById('wishModal');
  document.getElementById('btnNewWish').addEventListener('click', () => {
    document.getElementById('wishForm').reset();
    setActiveChip('#wishCatChips .chip', 'data-cat', '爱情');
    wishModal.style.display = 'flex';
  });
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(el.dataset.close).style.display = 'none';
    });
  });

  function setActiveChip(selector, attr, value) {
    document.querySelectorAll(selector).forEach(c => c.classList.toggle('active', c.getAttribute(attr) === value));
  }

  // 愿望分类 chip（事件委托，确保点击可靠切换）
  document.getElementById('wishCatChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setActiveChip('#wishCatChips .chip', 'data-cat', chip.dataset.cat);
  });

  document.getElementById('wishForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('wishText').value.trim();
    if (!text) return;
    const cat = document.querySelector('#wishCatChips .chip.active').dataset.cat;
    const deadline = document.getElementById('wishDeadline').value;
    store.wishes.unshift({ text, cat, deadline, createdAt: new Date().toISOString(), checks: {} });
    saveStore(store);
    wishModal.style.display = 'none';
    renderWishes();
    toast('愿望已种下 🌱');
  });

  // ===== 音乐模块 =====
  let musicGoal = '爱情', musicFreq = '432', musicDur = 10;
  let musicStyle = 'auto';           // 'auto' = AI 自动匹配风格
  let musicFx = new Set();           // 已选氛围特效音（多选）

  // 双耳节拍频率（目标 → 每秒节拍 Hz）
  const BEAT_BY_GOAL = { '爱情': 8, '财富': 10, '健康': 3, '内在平静': 6, '事业': 14 };

  // ===== AI 愿望理解（本地意图识别：关键词 → 目标/风格/特效音推荐）=====
  const WISH_RULES = [
    { goal: '财富',   kws: ['钱', '财', '富', '赚', '收入', '暴富', '金钱', '存下', '存款', '钞', '买', '房', '车', '红包', '涨薪', '副业', '生意'], style: '轻快民谣', fx: ['coins', 'chime'], reply: '财富能量已点亮：轻快旋律 + 金币叮当，助你显丰盛' },
    { goal: '爱情',   kws: ['爱', '恋', '脱单', '桃花', '对象', '男朋友', '女朋友', '男友', '女友', '伴侣', '结婚', '姻缘', '心动', 'crush'], style: '浪漫流行', fx: ['chime'], reply: '爱的频率已开启：浪漫旋律 + 风铃点缀，吸引对的人' },
    { goal: '内在平静', kws: ['平静', '放松', '焦虑', '压力', '失眠', '静心', '冥想', '情绪', '内耗', '安心', '睡', '烦躁', '累'], style: '空灵氛围', fx: ['rain'], reply: '细雨 + 空灵和声，帮你把心慢慢沉静下来' },
    { goal: '健康',   kws: ['健康', '身体', '病', '愈', '瘦', '减肥', '免疫', '体力', '气色', '康复', '运动'], style: '温暖治愈', fx: ['birds'], reply: '温暖旋律 + 清晨鸟鸣，唤醒身体自愈力' },
    { goal: '事业',   kws: ['事业', '工作', '升职', '面试', 'offer', '创业', '考试', '学业', '成功', '项目', '客户', '成交', 'offer', '业绩'], style: '清新流行', fx: ['birds'], reply: '事业能量启动中：清新旋律 + 鸟鸣提气，专注显化' }
  ];
  function interpretWish(text) {
    const t = String(text || '');
    let best = null, bestScore = 0;
    WISH_RULES.forEach(r => {
      let score = 0;
      r.kws.forEach(kw => { if (t.includes(kw)) score += 1; });
      if (score > bestScore) { bestScore = score; best = r; }
    });
    return bestScore > 0 ? best : null;
  }

  // ===== 导入伴奏（IndexedDB 存储本地音乐文件，支持 AI 生成 / 下载的 mp3）=====
  const MusicStore = (() => {
    const DB_NAME = 'guangyu_music';
    const STORE = 'tracks';
    const VERSION = 2;
    let db = null;
    let useMem = false;          // IndexedDB 不可用 / 不回调时降级为内存 Map
    let mem = null;
    function open() {
      return new Promise((resolve) => {
        if (useMem) { resolve(null); return; }
        if (db) { resolve(db); return; }
        if (!window.indexedDB) { useMem = true; mem = new Map(); resolve(null); return; }
        let settled = false;
        const to = setTimeout(() => {            // 兜底：4s 内无回调则降级内存，避免白屏
          if (settled) return; settled = true; useMem = true;
          if (!mem) mem = new Map(); resolve(null);
        }, 4000);
        let req;
        try { req = indexedDB.open(DB_NAME, VERSION); }
        catch (e) { settled = true; clearTimeout(to); useMem = true; mem = new Map(); resolve(null); return; }
        req.onupgradeneeded = (e) => {
          const d = e.target.result;
          // 老库（v1）已存在 store 时不再重建，仅安全补加索引
          let os = d.objectStoreNames.contains(STORE)
            ? e.target.transaction.objectStore(STORE)
            : d.createObjectStore(STORE, { keyPath: 'id' });
          if (!os.indexNames.contains('goal')) os.createIndex('goal', 'goal', { unique: false });
          if (!os.indexNames.contains('isPreset')) os.createIndex('isPreset', 'isPreset', { unique: false });
          if (!os.indexNames.contains('style')) os.createIndex('style', 'style', { unique: false });
        };
        req.onsuccess = () => { if (settled) return; settled = true; clearTimeout(to); db = req.result; resolve(db); };
        req.onerror = () => { if (settled) return; settled = true; clearTimeout(to); useMem = true; if (!mem) mem = new Map(); resolve(null); };
      });
    }
    async function put(track) {
      if (useMem) { mem.set(track.id, track); return; }
      const d = await open();
      if (useMem) { mem.set(track.id, track); return; }
      return new Promise((resolve) => {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(track);
        tx.oncomplete = () => resolve();
        tx.onerror = () => { useMem = true; mem.set(track.id, track); resolve(); };
      });
    }
    async function getAll() {
      if (useMem) return Array.from(mem.values());
      const d = await open();
      if (useMem) return Array.from(mem.values());
      return new Promise((resolve) => {
        const tx = d.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => { useMem = true; resolve(Array.from(mem.values())); };
      });
    }
    async function remove(id) {
      if (useMem) { mem.delete(id); return; }
      const d = await open();
      if (useMem) { mem.delete(id); return; }
      return new Promise((resolve) => {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => { useMem = true; mem.delete(id); resolve(); };
      });
    }
    async function getById(id) {
      if (useMem) return mem.get(id) || null;
      const d = await open();
      if (useMem) return mem.get(id) || null;
      return new Promise((resolve) => {
        const tx = d.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => { useMem = true; resolve(mem.get(id) || null); };
      });
    }
    async function incPlay(id) {
      try {
        const t = await getById(id);
        if (!t) return;
        t.playCount = (t.playCount || 0) + 1;
        await put(t);
      } catch (e) {}
    }
    return { put, getAll, getById, remove, incPlay };
  })();

  // ===== 预置伴奏曲库（用合成引擎一次性生成固定作品，入库标记 isPreset）=====
  // 每首 = 固定 params（目标 + 风格 + 频率 + 特效），播放时实时合成、下载时离线渲染，零存储占用
  const PRESET_LIBRARY = [
    { id:'p_love_1',   name:'心动信号',   goal:'爱情',     style:'浪漫流行', freq:432, fx:['chime'],          tags:['爱情','浪漫','甜'] },
    { id:'p_love_2',   name:'两心相悦',   goal:'爱情',     style:'钢琴叙事', freq:528, fx:[],                tags:['爱情','治愈','安静'] },
    { id:'p_wealth_1', name:'金光流动',   goal:'财富',     style:'轻快民谣', freq:432, fx:['coins','chime'],  tags:['财富','丰盛','金钱'] },
    { id:'p_wealth_2', name:'好事发生',   goal:'财富',     style:'清新流行', freq:639, fx:['coins'],          tags:['财富','好运','顺利'] },
    { id:'p_health_1', name:'森林氧吧',   goal:'健康',     style:'温暖治愈', freq:528, fx:['birds'],          tags:['健康','自然','放松'] },
    { id:'p_health_2', name:'晨光唤醒',   goal:'健康',     style:'空灵氛围', freq:432, fx:[],                tags:['健康','能量','清新'] },
    { id:'p_calm_1',   name:'静心细雨',   goal:'内在平静', style:'空灵氛围', freq:432, fx:['rain'],           tags:['平静','放松','睡眠'] },
    { id:'p_calm_2',   name:'归零',       goal:'内在平静', style:'钢琴叙事', freq:528, fx:[],                tags:['平静','冥想','沉静'] },
    { id:'p_career_1', name:'步步高升',   goal:'事业',     style:'清新流行', freq:432, fx:['birds'],         tags:['事业','职场','专注'] },
    { id:'p_career_2', name:'破局',       goal:'事业',     style:'轻快民谣', freq:639, fx:[],                tags:['事业','突破','自信'] }
  ];
  const FX_ZH = { rain:'细雨', waves:'海浪', stream:'溪流', fire:'篝火', birds:'鸟鸣', chime:'风铃', coins:'金币' };

  // 首次进入时把预置曲库写入 IndexedDB（只写缺失的，已存在则跳过，可热更新）
  async function ensurePresets() {
    let existing = [];
    try { existing = await MusicStore.getAll(); } catch (e) { return; }
    const have = new Set(existing.map(t => t.id));
    for (const p of PRESET_LIBRARY) {
      if (have.has(p.id)) continue;
      try {
        const beat = BEAT_BY_GOAL[p.goal] || 8;
        const params = SynthEngine.makeParams(p.goal, p.freq, beat, { styleName: p.style, fx: p.fx });
        await MusicStore.put({
          id: p.id, name: p.name, goal: p.goal, style: p.style, freq: p.freq,
          tags: p.tags || [], fx: p.fx, params, isPreset: true,
          note: `合成疗愈曲 · ${p.style} · ${p.freq}Hz`,
          addedAt: Date.now(), playCount: 0
        });
      } catch (e) {}
    }
  }

  // 伴奏库搜索 / 筛选状态
  let libQuery = '';
  let libFilter = 'all';
  let libRenderToken = 0;   // 防止连续触发 renderLibrary 时并发双写导致的重复渲染

  let importGoal = '爱情';
  let importAudio = null;      // 全局 <audio>，播放导入伴奏
  let importAudioUrl = null;   // 当前 objectURL，切换时回收

  // ===== Web Audio 合成引擎（真实生成疗愈音乐：改编名曲旋律 + 和弦伴奏 + 极轻频率 + 双耳节拍）=====
  const SynthEngine = (() => {
    let ctx = null;
    let playing = false;
    let stopFn = null;
    let loopTimer = null;
    let nextLoopTime = 0;
    const noiseBufs = new WeakMap();

    // ---- 和声与编排体系（相对主音基频的纯律频率倍数）----
    // 和弦库：开放和声（根音 + 五音 + 八度，不含三音）
    // 去掉三音后，任何旋律音都不会与和弦形成小二度拍频 —— 从根源上消除「嗡嗡」感
    const CHORDS = {
      I:   [1, 1.5, 2],                 // 主和弦（明亮安定）
      V:   [1.5, 2.25, 3],              // 属和弦（推动向前）
      vi:  [1.6667, 2.5, 3.3333],       // 小六和弦（温柔内敛）
      IV:  [1.3333, 2, 2.6667],         // 下属和弦（舒展）
      ii:  [1.125, 1.6875, 2.25],       // 小二级（细腻）
      iii: [1.25, 1.875, 2.5]           // 小三级（深情）
    };

    // ---- 多元编排风格库：不同和弦进行 + 音色 + 节奏 + 气质，让每次生成都不重样 ----
    const STYLES = {
      '浪漫流行':   { prog: ['I', 'V', 'vi', 'IV'],  bar: 5.5, padType: 'sine',     arpType: 'sine',     density: 0.60, delay: 0.40, padVol: 0.11, arpVol: 0.26, vibe: '温柔浪漫' },
      '轻快民谣':   { prog: ['I', 'IV', 'vi', 'V'],  bar: 4.5, padType: 'sine',     arpType: 'triangle', density: 0.70, delay: 0.32, padVol: 0.10, arpVol: 0.27, vibe: '轻快明亮' },
      '空灵氛围':   { prog: ['vi', 'IV', 'I', 'V'],  bar: 8,   padType: 'sine',     arpType: 'sine',     density: 0.35, delay: 0.60, padVol: 0.11, arpVol: 0.22, vibe: '空灵悠远' },
      '钢琴叙事':   { prog: ['I', 'vi', 'IV', 'V'],  bar: 6.5, padType: 'sine',     arpType: 'sine',     density: 0.45, delay: 0.50, padVol: 0.11, arpVol: 0.24, vibe: '安静抒情' },
      '温暖治愈':   { prog: ['I', 'iii', 'IV', 'V'], bar: 7,   padType: 'sine',     arpType: 'triangle', density: 0.40, delay: 0.55, padVol: 0.10, arpVol: 0.23, vibe: '温暖安定' },
      '清新流行':   { prog: ['I', 'vi', 'ii', 'V'],  bar: 5,   padType: 'sine',     arpType: 'triangle', density: 0.65, delay: 0.35, padVol: 0.10, arpVol: 0.26, vibe: '清新流畅' }
    };

    // 每个目标绑定一组适合它的风格（可重叠，随机轮换 → 多元化）
    const GOAL_STYLES = {
      '爱情':   ['浪漫流行', '温暖治愈', '钢琴叙事'],
      '财富':   ['轻快民谣', '清新流行', '浪漫流行'],
      '健康':   ['温暖治愈', '空灵氛围', '钢琴叙事'],
      '内在平静': ['空灵氛围', '温暖治愈'],
      '事业':   ['清新流行', '轻快民谣', '浪漫流行']
    };

    // ---- 公有领域名曲旋律库（改编自古典/民谣，无版权风险）----
    // 大调音阶（纯律，相对主音：do re mi fa sol la si do）
    const MAJOR_SCALE = [1, 1.125, 1.25, 1.3333, 1.5, 1.6667, 1.875, 2];
    // 音级序列（1=do … 8=高音do），都是家喻户晓的公有领域旋律
    const MELODY_MOTIFS = {
      '卡农':       { seq: [3,2,1,7,6,5,6,7, 1,7,6,5,4,3,4,5], vibe: '古典浪漫' },                    // 帕赫贝尔《卡农》
      '欢乐颂':     { seq: [3,3,4,5,5,4,3,2,1,1,2,3,3,2,2, 3,3,4,5,5,4,3,2,1,1,2,3,2,1,1], vibe: '明亮欢快' }, // 贝多芬《欢乐颂》
      '小星星':     { seq: [1,1,5,5,6,6,5, 4,4,3,3,2,2,1], vibe: '轻快清新' },                        // 莫扎特《小星星变奏曲》
      '友谊地久天长': { seq: [5,1,1,3,2,1,2,3,1,1,3,5,6,5,3,2,1,2,3,2,1,1], vibe: '舒缓怀旧' }          // 苏格兰民谣《友谊地久天长》
    };
    const GOAL_MOTIFS = {
      '爱情':   ['卡农', '小星星', '友谊地久天长'],
      '财富':   ['欢乐颂', '小星星'],
      '健康':   ['友谊地久天长', '卡农'],
      '内在平静': ['友谊地久天长', '卡农'],
      '事业':   ['小星星', '欢乐颂', '卡农']
    };
    // 音级 → 频率倍率（1=主音，8=高八度主音）
    function degreeRatio(d) {
      const idx = ((d - 1) % 7 + 7) % 7;
      const oct = Math.floor((d - 1) / 7);
      return MAJOR_SCALE[idx] * Math.pow(2, oct);
    }

    // 可复现伪随机（同一 seed 每次生成/下载一致，不同 seed 完全不同）
    function rng(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    let seedCounter = 0;
    function randomSeed() {
      seedCounter = (seedCounter + 1) & 0xffff;
      // 时间戳 + 随机 + 自增计数，确保每次生成 seed 都不同（伴奏不重样）
      return (((Date.now() & 0xfffff) << 12) ^ (Math.random() * 0xffffff | 0) ^ seedCounter) | 0;
    }

    let lastStyleName = null;
    function pickStyle(goal) {
      const names = GOAL_STYLES[goal] || GOAL_STYLES['内在平静'];
      let idx = (Math.random() * names.length) | 0;
      if (names.length > 1 && names[idx] === lastStyleName) idx = (idx + 1) % names.length;
      lastStyleName = names[idx];
      return { name: names[idx], config: STYLES[names[idx]] };
    }

    // 生成旋律：优先改编公有领域名曲，约 22% 概率走原创旋律（保证每次不重样）
    function melodyFromSeed(params) {
      const names = GOAL_MOTIFS[params.goal] || GOAL_MOTIFS['内在平静'];
      const rand = rng(params.seed ^ 0x9e3779b9);
      const useMotif = names.length > 0 && rand() > 0.22;
      if (useMotif) {
        const name = names[(rand() * names.length) | 0];
        const m = MELODY_MOTIFS[name];
        return { label: m.vibe + '·' + name, seq: m.seq.slice() };
      }
      // 原创：在音阶上随机漫步，形成自然旋律线
      const len = 24;
      const seq = [];
      let deg = 1 + ((rand() * 3) | 0);
      for (let i = 0; i < len; i++) {
        seq.push(deg);
        const step = [-2, -1, 1, 1, 2, 0][(rand() * 6) | 0];
        deg += step;
        if (deg < 1) deg = 1;
        if (deg > 8) deg = 5;
        if (rand() < 0.1) deg = 1;
      }
      return { label: '原创旋律', seq };
    }

    // ---- 氛围特效音（全部程序化合成，零版权风险）----
    // rain/stream/waves/fire 是持续底噪层；birds/chime/coins 是随机脉冲事件
    const FX_META = {
      rain:   { label: '细雨', vol: 0.040 },
      waves:  { label: '海浪', vol: 0.050 },
      stream: { label: '溪流', vol: 0.030 },
      fire:   { label: '篝火', vol: 0.028 },
      birds:  { label: '鸟鸣' },
      chime:  { label: '风铃' },
      coins:  { label: '金币' }
    };

    function makeParams(goal, freq, beat, opts) {
      opts = opts || {};
      let style;
      if (opts.styleName && STYLES[opts.styleName]) {
        style = { name: opts.styleName, config: STYLES[opts.styleName] };
        lastStyleName = opts.styleName;
      } else {
        style = pickStyle(goal);
      }
      const params = { freq: +freq, beat, goal, seed: randomSeed(), styleName: style.name, style: style.config };
      params.melody = melodyFromSeed(params);
      params.fx = (opts.fx || []).filter(f => FX_META[f]);
      params.fxLabels = params.fx.map(f => FX_META[f].label);
      params.wish = opts.wish || '';
      return params;
    }

    function loopLength(params) {
      const m = params.style;
      return m.bar * m.prog.length;
    }

    function ensureCtx() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function getNoiseBuffer(c) {
      if (noiseBufs.has(c)) return noiseBufs.get(c);
      const len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noiseBufs.set(c, buf);
      return buf;
    }

    // 把频率压到悦耳区间（上限压到 950，避免高频刺耳）
    function fitFreq(f) {
      while (f > 950) f /= 2;
      while (f < 70) f *= 2;
      return (f >= 70 && f <= 950) ? f : null;
    }

    function addTone(c, dest, freqVal, vol, pan, t) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freqVal;
      const gain = c.createGain();
      gain.gain.value = vol;
      const panner = c.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(gain); gain.connect(panner); panner.connect(dest);
      osc.start(t);
      return osc;
    }

    function addNoise(c, dest, t) {
      const noise = c.createBufferSource();
      noise.buffer = getNoiseBuffer(c);
      noise.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const gain = c.createGain();
      gain.gain.value = 0.05; // 相对音量，由频率层总控 droneGain 统一淡入/呼吸
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      noise.start(t);
      return noise;
    }

    // 一个持续的和弦音：三个轻微失谐正弦叠成柔软铺底（起音/收尾都极缓，绝不嗡鸣）
    function padNote(c, dest, f, t0, t1, vol, type) {
      const a = Math.min(2.6, (t1 - t0) * 0.6);
      const r = Math.min(2.8, (t1 - t0) * 0.6);
      const detunes = [0, 1.5, -1.5]; // 极轻微失谐（±1.5 cents），柔软不嗡
      detunes.forEach((dt) => {
        const osc = c.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = f;
        osc.detune.value = dt;
        const g = c.createGain();
        const v = vol / detunes.length;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v, t0 + a);
        g.gain.setValueAtTime(v, Math.max(t0 + a, t1 - r));
        g.gain.exponentialRampToValueAtTime(0.0001, t1);
        osc.connect(g); g.connect(dest);
        osc.start(t0);
        osc.stop(t1 + 0.05);
      });
    }

    // 一个自然乐器感的旋律音：基频 + 少量谐波按自然规律衰减（竖琴/木琴般的柔润拨弦）
    // 高次谐波压得更低、起音放缓到 12ms —— 既没有电子毛刺，也没有生硬的「咔哒」感
    function pluck(c, dest, f, t0, vol, type, pan) {
      const panner = c.createStereoPanner();
      panner.pan.value = pan || 0;
      panner.connect(dest);
      const harmonics = [1, 2, 3, 4];
      const hGains = [1, 0.28, 0.09, 0.03];
      const decay = 1.15;
      harmonics.forEach((h, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * h;
        const g = c.createGain();
        const hv = vol * hGains[i];
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(hv, t0 + 0.012 + i * 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay / (i + 1));
        osc.connect(g); g.connect(panner);
        osc.start(t0);
        osc.stop(t0 + decay + 0.1);
      });
    }

    // 低音线条：柔和的拨弦式低音（短促衰减，绝不持续嗡鸣）
    function bassNote(c, dest, f, t0, t1, vol) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
      osc.connect(g); g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 2.1);
    }

    // 连续层：根音 + 双耳节拍 + 白噪音（慢速淡入 + 呼吸感，音量约为伴奏的 30%，绝不刺耳）
    function addDroneLayer(c, master, params, t) {
      const freq = params.freq, beat = params.beat;
      // 低通柔化：截止压到 160Hz，把 432–528Hz 的纯音衰减 30dB 以上（真正消除蜂鸣感）
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      // 频率层总控：6 秒慢慢浮现（淡入），总音量压到「仅可被潜意识感知」的极限
      const droneGain = c.createGain();
      droneGain.gain.setValueAtTime(0.0001, t);
      droneGain.gain.exponentialRampToValueAtTime(0.001, t + 6);
      // 呼吸感 LFO：0.08Hz 极缓起伏，幅度同步压到极小
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoAmt = c.createGain();
      lfoAmt.gain.value = 0.0004;
      lfo.connect(lfoAmt); lfoAmt.connect(droneGain.gain);
      lfo.start(t);
      lp.connect(droneGain); droneGain.connect(master);

      const src = [];
      src.push(addTone(c, lp, freq, 0.35, -1, t));       // 左耳根音（总音量由 droneGain 控制）
      src.push(addTone(c, lp, freq + beat, 0.35, 1, t)); // 右耳节拍
      src.push(addNoise(c, droneGain, t));               // 白噪音也走淡入/呼吸控制
      src.push(lfo);
      return src;
    }

    // ---- 氛围特效音：持续底噪层（细雨/海浪/溪流/篝火），4 秒淡入，音量极轻 ----
    function addAmbienceLayer(c, master, params, t) {
      const src = [];
      (params.fx || []).forEach(fx => {
        const g = c.createGain();
        const vol = FX_META[fx].vol || 0.03;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 4);
        g.connect(master);

        if (fx === 'rain' || fx === 'stream') {
          // 细雨：宽带嘶声（高通 900 + 低通 6500）；溪流：中频汩汩（带通 1800）
          const noise = c.createBufferSource();
          noise.buffer = getNoiseBuffer(c);
          noise.loop = true;
          const f1 = c.createBiquadFilter();
          f1.type = fx === 'rain' ? 'highpass' : 'bandpass';
          f1.frequency.value = fx === 'rain' ? 900 : 1800;
          if (fx === 'stream') f1.Q.value = 0.7;
          const f2 = c.createBiquadFilter();
          f2.type = 'lowpass';
          f2.frequency.value = fx === 'rain' ? 6500 : 5200;
          noise.connect(f1); f1.connect(f2); f2.connect(g);
          noise.start(t);
          src.push(noise);
        } else if (fx === 'waves') {
          // 海浪：低频噪声 + 0.07Hz 慢速浪潮起伏
          const noise = c.createBufferSource();
          noise.buffer = getNoiseBuffer(c);
          noise.loop = true;
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 480;
          noise.connect(lp); lp.connect(g);
          const lfo = c.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = 0.07;
          const lfoAmt = c.createGain();
          lfoAmt.gain.value = vol * 0.55;
          lfo.connect(lfoAmt); lfoAmt.connect(g.gain);
          lfo.start(t);
          noise.start(t);
          src.push(noise, lfo);
        } else if (fx === 'fire') {
          // 篝火底：低频暖声（爆裂脉冲在循环调度里触发）
          const noise = c.createBufferSource();
          noise.buffer = getNoiseBuffer(c);
          noise.loop = true;
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 320;
          noise.connect(lp); lp.connect(g);
          noise.start(t);
          src.push(noise);
        }
      });
      return src;
    }

    // ---- 氛围特效音：随机脉冲事件（鸟鸣/风铃/金币/篝火爆裂）----
    function birdChirp(c, dest, t, vol) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      const f0 = 2300 + Math.random() * 1200;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * (0.72 + Math.random() * 0.56), t + 0.09);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      const panner = c.createStereoPanner();
      panner.pan.value = (Math.random() - 0.5) * 1.2;
      osc.connect(g); g.connect(panner); panner.connect(dest);
      osc.start(t); osc.stop(t + 0.2);
    }
    function coinTinkle(c, dest, t, vol) {
      // 金币叮当：两枚不谐和高频正弦叠加，清脆金属感
      [2093, 2794].forEach((f, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * (0.98 + Math.random() * 0.04);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * (i ? 0.55 : 1), t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        const panner = c.createStereoPanner();
        panner.pan.value = (Math.random() - 0.5) * 0.8;
        osc.connect(g); g.connect(panner); panner.connect(dest);
        osc.start(t); osc.stop(t + 0.55);
      });
    }
    function fireCrackle(c, dest, t, vol) {
      const noise = c.createBufferSource();
      noise.buffer = getNoiseBuffer(c);
      noise.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 1800;
      bp.Q.value = 1.2;
      const g = c.createGain();
      const dur = 0.02 + Math.random() * 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * (0.5 + Math.random() * 0.5), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      noise.connect(bp); bp.connect(g); g.connect(dest);
      noise.start(t); noise.stop(t + dur + 0.05);
    }
    // 每个循环里按概率调度脉冲事件（实时播放与离线导出共用同一套逻辑）
    function scheduleFxAmbience(c, buses, params, t0, loopLen) {
      const fx = params.fx || [];
      if (!fx.length) return;
      const rand = rng((params.seed ^ Math.floor(t0 * 977)) >>> 0);
      const barLen = loopLen / params.style.prog.length;
      const bars = params.style.prog.length;
      for (let b = 0; b < bars; b++) {
        const bt = t0 + b * barLen;
        if (fx.includes('birds') && rand() < 0.5) {
          const n = 1 + ((rand() * 2) | 0);
          for (let i = 0; i < n; i++) birdChirp(c, buses.pad, bt + rand() * barLen, 0.014 + rand() * 0.012);
        }
        if (fx.includes('chime') && rand() < 0.35) {
          const f = 1568 * [1, 1.125, 1.3333, 1.5, 1.6875][(rand() * 5) | 0] * (rand() < 0.3 ? 2 : 1);
          pluck(c, buses.lead, f, bt + rand() * barLen, 0.026, 'sine', (rand() - 0.5) * 0.8);
        }
        if (fx.includes('coins') && rand() < 0.6) {
          const n = 1 + ((rand() * 2) | 0);
          for (let i = 0; i < n; i++) coinTinkle(c, buses.pad, bt + rand() * barLen, 0.03);
        }
        if (fx.includes('fire')) {
          const n = 2 + ((rand() * 3) | 0);
          for (let i = 0; i < n; i++) fireCrackle(c, buses.pad, bt + rand() * barLen, 0.045);
        }
      }
    }

    // 安排主旋律（名曲改编/原创）铺满整个循环：均匀节奏，保留原曲自然韵律
    function scheduleLeadMelody(c, buses, params, t0, loopLen) {
      const m = params.style;
      const base = params.freq;
      const seq = params.melody.seq;
      const n = seq.length;
      const noteDur = loopLen / n;
      seq.forEach((deg, i) => {
        let f = base * degreeRatio(deg);
        while (f > 900) f /= 2;
        while (f < 130) f *= 2;
        // 力度自然起伏：每 4 拍一个柔和重音，其余更轻，有呼吸感
        const accent = (i % 4 === 0) ? 0.9 : 0.68;
        // 高频响度补偿：音高越高听感越「尖」，按平方根衰减，高音不再刺耳突出
        const hfComp = f > 520 ? Math.sqrt(520 / f) : 1;
        // 声像温和左右交替（不随机乱跳，听起来更稳）
        const pan = (i % 2 === 0) ? -0.28 : 0.28;
        pluck(c, buses.lead, f, t0 + i * noteDur, m.arpVol * accent * hfComp, m.arpType, pan);
      });
    }

    // 一个循环的「和弦铺底 + 低音 + 主旋律」
    function scheduleMusicLoop(c, buses, params, t0) {
      const m = params.style;
      const base = params.freq;
      const barLen = m.bar;
      m.prog.forEach((ch, i) => {
        const mults = CHORDS[ch] || CHORDS.I;
        const t1 = t0 + i * barLen;
        const t2 = t1 + barLen;
        // 低音线条：低八度根音（柔和拨弦，音量小、频率不低于 90Hz，避免低频嗡鸣）
        let bassF = base * mults[0] / 2;
        while (bassF < 90) bassF *= 2;
        bassNote(c, buses.pad, bassF, t1, t2, 0.06);
        mults.forEach((mult, k) => {
          const f = fitFreq(base * mult);
          if (!f) return;
          const panner = c.createStereoPanner();
          panner.pan.value = (k % 2 ? 0.3 : -0.3);
          panner.connect(buses.pad);
          padNote(c, panner, f, t1, t2, m.padVol, m.padType);
        });
      });
      // 主旋律铺满整个循环
      scheduleLeadMelody(c, buses, params, t0, loopLength(params));
      // 氛围特效音脉冲事件（鸟鸣/风铃/金币/篝火爆裂）
      scheduleFxAmbience(c, buses, params, t0, loopLength(params));
    }

    // 搭建总图：连续层 + 和声/琶音总线 + 延迟回声 + 压缩器（防爆音）
    function buildBase(c, dest, params) {
      const t = c.currentTime;
      const m = params.style;

      const master = c.createGain();
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.66, t + 3); // 3 秒整体淡入，柔和开场不突兀

      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.01;
      comp.release.value = 0.28;
      master.connect(comp);
      comp.connect(dest);

      const pad = c.createGain(); pad.gain.value = 1;
      const lead = c.createGain(); lead.gain.value = 1;

      // 柔化高频：给伴奏总线加低通，滤掉刺耳的泛音毛刺，让音色更温暖耐听
      const padLP = c.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 900;
      const leadLP = c.createBiquadFilter(); leadLP.type = 'lowpass'; leadLP.frequency.value = 1800;
      pad.connect(padLP); padLP.connect(master);
      lead.connect(leadLP); leadLP.connect(master);

      const delay = c.createDelay(2); delay.delayTime.value = m.delay;
      const fb = c.createGain(); fb.gain.value = 0.30;
      const wet = c.createGain(); wet.gain.value = 0.42;
      leadLP.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

      const sources = addDroneLayer(c, master, params, t);
      const ambSources = addAmbienceLayer(c, master, params, t);
      return { master, pad, lead, sources: sources.concat(ambSources) };
    }

    function start(params) {
      if (!params.style) params = makeParams(params.goal, params.freq, params.beat);
      const c = ensureCtx();
      if (!c) return false;
      stop();
      const g = buildBase(c, c.destination, params);
      const loopLen = loopLength(params);
      nextLoopTime = c.currentTime + 0.15;
      const schedule = () => {
        while (nextLoopTime < c.currentTime + 1.5) {
          scheduleMusicLoop(c, g, params, nextLoopTime);
          nextLoopTime += loopLen;
        }
      };
      schedule();
      loopTimer = setInterval(schedule, 400);
      stopFn = () => {
        clearInterval(loopTimer);
        const now = c.currentTime;
        try {
          g.master.gain.cancelScheduledValues(now);
          g.master.gain.setValueAtTime(Math.max(g.master.gain.value, 0.0001), now);
          g.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
        } catch (e) {}
        setTimeout(() => {
          g.sources.forEach(n => { try { n.stop(); } catch (e) {} });
          try { g.master.disconnect(); } catch (e) {}
        }, 950);
      };
      playing = true;
      return true;
    }

    function stop() {
      if (stopFn) { const f = stopFn; stopFn = null; try { f(); } catch (e) {} }
      playing = false;
    }

    function audioBufferToWav(buffer) {
      const numCh = buffer.numberOfChannels;
      const rate = buffer.sampleRate;
      const dataLen = buffer.length * numCh * 2;
      const ab = new ArrayBuffer(44 + dataLen);
      const view = new DataView(ab);
      function wstr(off, s) { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
      wstr(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); wstr(8, 'WAVE');
      wstr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numCh, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * numCh * 2, true); view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true);
      wstr(36, 'data'); view.setUint32(40, dataLen, true);
      let off = 44;
      const chans = [];
      for (let i = 0; i < numCh; i++) chans.push(buffer.getChannelData(i));
      for (let i = 0; i < buffer.length; i++) {
        for (let cIdx = 0; cIdx < numCh; cIdx++) {
          let s = Math.max(-1, Math.min(1, chans[cIdx][i]));
          view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          off += 2;
        }
      }
      return new Blob([ab], { type: 'audio/wav' });
    }

    async function renderWav(params, seconds) {
      const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC) return null;
      const rate = 44100;
      const c = new AC(2, Math.floor(rate * seconds), rate);
      const g = buildBase(c, c.destination, params);
      const loopLen = loopLength(params);
      const loops = Math.ceil(seconds / loopLen) + 1;
      for (let i = 0; i < loops; i++) {
        scheduleMusicLoop(c, g, params, i * loopLen);
      }
      const buf = await c.startRendering();
      return audioBufferToWav(buf);
    }

    return { start, stop, renderWav, makeParams, isPlaying: () => playing };
  })();

  let currentTrack = null;

  // ===== 主题动态特效层（canvas 粒子，叠在实景图上让背景真正「流动」） =====
  // 财富=金光流动 / 爱情=樱花飘落 / 健康=森林光斑飘叶 / 平静=星空流星 / 事业=日出光束云海
  const ThemeFX = (() => {
    const TAU = Math.PI * 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[(Math.random() * arr.length) | 0];

    function softGlow(ctx, x, y, r, rgb, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(0.5, `rgba(${rgb},${a * 0.3})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }

    function petalShape(ctx, x, y, r, rot, fill) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.95, -r * 0.55, r * 0.7, r * 0.65, 0, r);
      ctx.bezierCurveTo(-r * 0.7, r * 0.65, -r * 0.95, -r * 0.55, 0, -r);
      ctx.fill(); ctx.restore();
    }

    function leafShape(ctx, x, y, r, rot, rgb, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = `rgba(${rgb},${a})`;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.75, 0, 0, r);
      ctx.quadraticCurveTo(-r * 0.75, 0, 0, -r);
      ctx.fill(); ctx.restore();
    }

    function starFlare(ctx, x, y, r, a) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = `rgba(255,240,200,${a})`;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.09, -r * 0.09, r, 0);
      ctx.quadraticCurveTo(r * 0.09, r * 0.09, 0, r);
      ctx.quadraticCurveTo(-r * 0.09, r * 0.09, -r, 0);
      ctx.quadraticCurveTo(-r * 0.09, -r * 0.09, 0, -r);
      ctx.fill(); ctx.restore();
      softGlow(ctx, x, y, r * 1.8, '246,214,120', a * 0.55);
    }

    // 漂浮微尘（多个场景复用）：柔和发光 + 明暗呼吸
    function makeMotes(n, rgb, sMin, sMax) {
      return Array.from({ length: n }, () => ({
        x: Math.random(), y: Math.random(), r: rand(sMin, sMax),
        vx: rand(-0.012, 0.012), vy: rand(-0.014, 0.008),
        ph: rand(0, TAU), tw: rand(0.7, 2.2), a: rand(0.3, 0.7), rgb,
      }));
    }
    function drawMotes(list, ctx, W, H, t, dt) {
      list.forEach((m) => {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < -0.05) m.x = 1.05; else if (m.x > 1.05) m.x = -0.05;
        if (m.y < -0.05) m.y = 1.05; else if (m.y > 1.05) m.y = -0.05;
        const a = m.a * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * m.tw + m.ph)));
        softGlow(ctx, m.x * W, m.y * H, m.r * 3, m.rgb, a * 0.45);
        ctx.fillStyle = `rgba(${m.rgb},${a})`;
        ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.r, 0, TAU); ctx.fill();
      });
    }

    // —— 财富：金光流动（流动金色光带 + 金屑上升 + 大金光斑 + 偶发闪光） ——
    function wealthScene() {
      const dust = Array.from({ length: 42 }, () => ({
        x: Math.random(), y: rand(-0.05, 1.05), r: rand(0.7, 2.3),
        vy: rand(0.02, 0.06), sway: rand(0.01, 0.035), ph: rand(0, TAU), tw: rand(1.5, 4),
      }));
      const halo = Array.from({ length: 8 }, () => ({
        x: Math.random(), y: Math.random(), r: rand(22, 58),
        vx: rand(-0.008, 0.008), vy: rand(-0.005, 0.005), a: rand(0.05, 0.11),
      }));
      const ribbons = [0, 1, 2].map((i) => ({
        yB: 0.26 + i * 0.24, amp: rand(0.04, 0.09), freq: rand(1.1, 2),
        ph: rand(0, TAU), sp: rand(0.1, 0.28), w: rand(14, 32),
      }));
      let glints = [], gTimer = rand(0.8, 2);
      return (ctx, W, H, t, dt) => {
        ribbons.forEach((rb) => {
          ctx.beginPath();
          for (let p = 0; p <= 1.0001; p += 0.05) {
            const y = (rb.yB + Math.sin(p * rb.freq * TAU + t * rb.sp + rb.ph) * rb.amp) * H;
            if (p === 0) ctx.moveTo(0, y); else ctx.lineTo(p * W, y);
          }
          const g = ctx.createLinearGradient(0, 0, W, 0);
          g.addColorStop(0, 'rgba(238,198,100,0)');
          g.addColorStop(0.5, 'rgba(246,216,126,0.17)');
          g.addColorStop(1, 'rgba(238,198,100,0)');
          ctx.strokeStyle = g; ctx.lineWidth = rb.w; ctx.lineCap = 'round'; ctx.stroke();
        });
        halo.forEach((h) => {
          h.x += h.vx * dt; h.y += h.vy * dt;
          if (h.x < -0.15) h.x = 1.15; else if (h.x > 1.15) h.x = -0.15;
          if (h.y < -0.15) h.y = 1.15; else if (h.y > 1.15) h.y = -0.15;
          softGlow(ctx, h.x * W, h.y * H, h.r, '238,196,96', h.a);
        });
        dust.forEach((s) => {
          s.y -= s.vy * dt;
          if (s.y < -0.05) { s.y = 1.06; s.x = Math.random(); }
          const x = (s.x + Math.sin(t * 0.5 + s.ph) * s.sway) * W;
          const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
          softGlow(ctx, x, s.y * H, s.r * 3, '250,220,140', a * 0.5);
          ctx.fillStyle = `rgba(255,236,180,${a})`;
          ctx.beginPath(); ctx.arc(x, s.y * H, s.r, 0, TAU); ctx.fill();
        });
        gTimer -= dt;
        if (gTimer <= 0) {
          glints.push({ x: rand(0.08, 0.92), y: rand(0.08, 0.92), r: rand(9, 20), life: 0, dur: rand(1.1, 1.9) });
          gTimer = rand(1.4, 3.2);
        }
        glints = glints.filter((gl) => (gl.life += dt) < gl.dur);
        glints.forEach((gl) => {
          const ph = gl.life / gl.dur;
          starFlare(ctx, gl.x * W, gl.y * H, gl.r * (0.4 + 0.6 * Math.sin(Math.PI * ph)), Math.sin(Math.PI * ph) * 0.85);
        });
      };
    }

    // —— 爱情：樱花瓣摇曳飘落 + 粉色微尘 ——
    function loveScene() {
      const PINKS = ['255,183,197', '249,168,186', '255,205,214', '252,177,205'];
      function newPetal(anywhere) {
        return {
          x: Math.random(), y: anywhere ? Math.random() : -0.06,
          r: rand(5, 11), vy: rand(0.022, 0.055), sway: rand(0.015, 0.05),
          ph: rand(0, TAU), rot: rand(0, TAU), vr: rand(-0.9, 0.9),
          rgb: pick(PINKS), a: rand(0.55, 0.9),
        };
      }
      const petals = Array.from({ length: 15 }, () => newPetal(true));
      const motes = makeMotes(16, '255,214,224', 0.6, 1.4);
      return (ctx, W, H, t, dt) => {
        drawMotes(motes, ctx, W, H, t, dt);
        petals.forEach((p) => {
          p.y += p.vy * dt; p.rot += p.vr * dt;
          if (p.y > 1.08) Object.assign(p, newPetal(false));
          const x = (p.x + Math.sin(t * 0.55 + p.ph) * p.sway) * W;
          const fade = p.y < 0.06 ? p.y / 0.06 : (p.y > 0.92 ? (1.05 - p.y) / 0.13 : 1);
          petalShape(ctx, x, p.y * H, p.r, p.rot, `rgba(${p.rgb},${(p.a * Math.max(0, Math.min(1, fade))).toFixed(3)})`);
        });
      };
    }

    // —— 健康：森林阳光（树影光斑 + 飘叶 + 光尘） ——
    function healthScene() {
      const GREENS = ['126,186,124', '158,204,130', '108,170,110'];
      function newLeaf(anywhere) {
        return {
          x: Math.random(), y: anywhere ? Math.random() : -0.06,
          r: rand(6, 12), vy: rand(0.015, 0.04), sway: rand(0.02, 0.06),
          ph: rand(0, TAU), rot: rand(0, TAU), vr: rand(-0.7, 0.7),
          rgb: pick(GREENS), a: rand(0.4, 0.75),
        };
      }
      const leaves = Array.from({ length: 9 }, () => newLeaf(true));
      const motes = makeMotes(26, '232,246,205', 0.7, 1.8);
      const light = Array.from({ length: 5 }, () => ({
        x: Math.random(), y: Math.random(), r: rand(40, 90),
        vx: rand(-0.006, 0.006), vy: rand(-0.004, 0.004), a: rand(0.05, 0.1),
      }));
      return (ctx, W, H, t, dt) => {
        light.forEach((l) => {
          l.x += l.vx * dt; l.y += l.vy * dt;
          if (l.x < -0.2) l.x = 1.2; else if (l.x > 1.2) l.x = -0.2;
          if (l.y < -0.2) l.y = 1.2; else if (l.y > 1.2) l.y = -0.2;
          softGlow(ctx, l.x * W, l.y * H, l.r, '240,250,205', l.a);
        });
        drawMotes(motes, ctx, W, H, t, dt);
        leaves.forEach((p) => {
          p.y += p.vy * dt; p.rot += p.vr * dt;
          if (p.y > 1.08) Object.assign(p, newLeaf(false));
          const x = (p.x + Math.sin(t * 0.5 + p.ph) * p.sway) * W;
          leafShape(ctx, x, p.y * H, p.r, p.rot, p.rgb, p.a);
        });
      };
    }

    // —— 内在平静：星空（星星闪烁 + 流星 + 夜雾） ——
    function calmScene() {
      const stars = Array.from({ length: 55 }, () => ({
        x: Math.random(), y: Math.random(), r: rand(0.5, 1.7),
        ph: rand(0, TAU), tw: rand(0.5, 2.4), big: Math.random() < 0.12,
      }));
      const mist = Array.from({ length: 7 }, () => ({
        x: Math.random(), y: Math.random(), r: rand(30, 70),
        vx: rand(-0.006, 0.006), a: rand(0.04, 0.09),
      }));
      let shoot = null, sTimer = rand(2.5, 6);
      return (ctx, W, H, t, dt) => {
        mist.forEach((m) => {
          m.x += m.vx * dt;
          if (m.x < -0.2) m.x = 1.2; else if (m.x > 1.2) m.x = -0.2;
          softGlow(ctx, m.x * W, m.y * H, m.r, '170,190,235', m.a);
        });
        stars.forEach((s) => {
          const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
          const x = s.x * W, y = s.y * H;
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
          if (s.big) softGlow(ctx, x, y, s.r * 5, '220,230,255', a * 0.35);
        });
        sTimer -= dt;
        if (!shoot && sTimer <= 0) {
          shoot = { x: rand(0.1, 0.8), y: rand(0.04, 0.3), vx: rand(0.28, 0.5), vy: rand(0.12, 0.22), life: 0, dur: rand(0.9, 1.3) };
        }
        if (shoot) {
          shoot.life += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
          const a = Math.sin(Math.PI * Math.min(1, shoot.life / shoot.dur)) * 0.95;
          const x = shoot.x * W, y = shoot.y * H, L = 100;
          const g = ctx.createLinearGradient(x - shoot.vx * L, y - shoot.vy * L, x, y);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, `rgba(255,255,255,${a})`);
          ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - shoot.vx * L, y - shoot.vy * L); ctx.lineTo(x, y); ctx.stroke();
          if (shoot.life >= shoot.dur) { shoot = null; sTimer = rand(4, 9); }
        }
      };
    }

    // —— 事业：云海日出（顶部光束 + 云絮漂移 + 暖光微尘上升） ——
    function careerScene() {
      const motes = makeMotes(22, '255,226,180', 0.7, 1.6);
      const clouds = Array.from({ length: 6 }, () => ({
        x: rand(-0.2, 1.2), y: rand(0.25, 0.9), r: rand(30, 70),
        vx: rand(0.008, 0.025), a: rand(0.05, 0.12),
      }));
      return (ctx, W, H, t, dt) => {
        ctx.save();
        ctx.translate(W * 0.5, -H * 0.18);
        for (let i = 0; i < 6; i++) {
          const ang = (i - 2.5) * 0.2 + Math.sin(t * 0.1 + i * 1.7) * 0.05;
          const len = H * 1.5, w = W * (0.05 + 0.025 * ((i * 37) % 10) / 10);
          ctx.save(); ctx.rotate(ang);
          const g = ctx.createLinearGradient(0, 0, 0, len);
          g.addColorStop(0, 'rgba(255,232,190,0.13)');
          g.addColorStop(1, 'rgba(255,232,190,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
          ctx.lineTo(w * 1.7, len); ctx.lineTo(-w * 1.7, len);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        clouds.forEach((c) => {
          c.x += c.vx * dt;
          if (c.x > 1.25) { c.x = -0.25; c.y = rand(0.25, 0.9); }
          ctx.save();
          ctx.translate(c.x * W, c.y * H); ctx.scale(2.3, 1);
          softGlow(ctx, 0, 0, c.r, '255,248,235', c.a);
          ctx.restore();
        });
        drawMotes(motes, ctx, W, H, t, dt);
      };
    }

    // —— 默认：柔和紫微尘 ——
    function defaultScene() {
      const motes = makeMotes(24, '200,180,240', 0.7, 1.6);
      return (ctx, W, H, t, dt) => drawMotes(motes, ctx, W, H, t, dt);
    }

    const FACTORIES = {
      'theme-wealth': wealthScene, 'theme-love': loveScene, 'theme-health': healthScene,
      'theme-calm': calmScene, 'theme-career': careerScene, 'theme-default': defaultScene,
    };

    const slots = [];
    let raf = 0, last = 0;

    function tick(ts) {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = ts; return; }
      const t = ts / 1000;
      const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000));
      last = ts;
      slots.forEach((s) => {
        if (s.el.getClientRects().length === 0) return; // 元素隐藏时跳过绘制
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = s.el.clientWidth, h = s.el.clientHeight;
        if (!w || !h) return;
        const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
        if (s.el.width !== bw || s.el.height !== bh) { s.el.width = bw; s.el.height = bh; }
        s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        s.ctx.clearRect(0, 0, w, h);
        if (s.scene) s.scene(s.ctx, w, h, t, dt);
      });
    }

    function setTheme(cls) {
      const f = FACTORIES[cls] || FACTORIES['theme-default'];
      slots.forEach((s) => { s.scene = f(); });
    }

    function init() {
      document.querySelectorAll('canvas.theme-fx').forEach((el) => {
        slots.push({ el, ctx: el.getContext('2d'), scene: null });
      });
      setTheme('theme-default');
      raf = requestAnimationFrame(tick);
    }

    return { init, setTheme };
  })();
  ThemeFX.init();

  // ===== 主题动态背景（播放器背景 / 全屏沉浸屏保） =====
  const THEME_CLASS = { '爱情': 'theme-love', '财富': 'theme-wealth', '健康': 'theme-health', '内在平静': 'theme-calm', '事业': 'theme-career' };
  let currentTheme = 'theme-default';

  function applyTheme(goal) {
    const cls = THEME_CLASS[goal] || 'theme-default';
    if (cls === currentTheme) return;
    const card = document.getElementById('playerCard');
    const ss = document.getElementById('screensaver');
    [card, ss].forEach(el => {
      if (!el) return;
      el.classList.remove(currentTheme);
      el.classList.add(cls);
    });
    currentTheme = cls;
    ThemeFX.setTheme(cls); // 同步切换粒子场景（金光流动/樱花/森林/星空/日出）
  }

  // 沉浸模式控件：打开时显示 3.2 秒后自动淡出；点按屏幕任意处重新唤出（图片保持纯净无遮挡）
  let ssControlsTimer = null;
  function showSsControls() {
    const c = document.querySelector('#screensaver .ss-content');
    if (!c) return;
    c.classList.remove('hide');
    clearTimeout(ssControlsTimer);
    ssControlsTimer = setTimeout(() => c.classList.add('hide'), 3200);
  }
  function hideSsControlsNow() {
    clearTimeout(ssControlsTimer);
    const c = document.querySelector('#screensaver .ss-content');
    if (c) c.classList.add('hide');
  }

  // 沉浸模式经文：进入时渲染当前曲目经文，逐行呼吸式高亮（独立于播放器面板的朗读高亮）
  let ssScriptureTimer = null;
  function renderSsScripture() {
    const box = document.getElementById('ssScripture');
    if (!box) return;
    if (!currentTrack || !currentTrack.scripture || !currentTrack.scripture.length) {
      box.style.display = 'none'; box.innerHTML = ''; return;
    }
    box.innerHTML = currentTrack.scripture.map(l => '<div class="sr-line">' + escapeHtml(l) + '</div>').join('');
    box.style.display = 'flex';
  }
  function startSsScriptureLoop() {
    const box = document.getElementById('ssScripture');
    if (!box || box.style.display === 'none') return;
    const lines = Array.from(box.querySelectorAll('.sr-line'));
    if (!lines.length) return;
    let i = 0;
    const hl = () => lines.forEach((el, idx) => el.classList.toggle('sr-active', idx === i));
    hl(0);
    ssScriptureTimer = setInterval(() => { i = (i + 1) % lines.length; hl(i); }, 3600);
  }
  function stopSsScriptureLoop() {
    if (ssScriptureTimer) { clearInterval(ssScriptureTimer); ssScriptureTimer = null; }
    const box = document.getElementById('ssScripture');
    if (box) box.querySelectorAll('.sr-line').forEach(el => el.classList.remove('sr-active'));
  }

  function openScreensaver() {
    if (!currentTrack) { toast('先点「生成」或选一首伴奏哦'); return; }
    const ss = document.getElementById('screensaver');
    updateSsPlayButton();
    ss.style.display = 'flex';
    renderSsScripture();
    startSsScriptureLoop();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ss.classList.add('show');
      showSsControls();
    }));
  }

  function closeScreensaver() {
    const ss = document.getElementById('screensaver');
    hideSsControlsNow();
    stopSsScriptureLoop();
    ss.classList.remove('show');
    setTimeout(() => { ss.style.display = 'none'; }, 450);
  }

  function updateSsPlayButton() {
    const playing = SynthEngine.isPlaying() || (getImportAudio() && !getImportAudio().paused);
    const b = document.getElementById('btnSsPlay');
    if (b) b.textContent = playing ? '暂停' : '播放';
  }

  document.getElementById('btnImmersive').addEventListener('click', openScreensaver);
  document.getElementById('playerVisual').addEventListener('click', openScreensaver);
  document.getElementById('btnSsClose').addEventListener('click', closeScreensaver);
  document.getElementById('btnSsPlay').addEventListener('click', () => {
    document.getElementById('btnPlayPause').click();
    setTimeout(updateSsPlayButton, 120);
    showSsControls(); // 操作后控件再停留一会儿，避免播放中突然消失
  });
  // 点按屏幕：控件隐藏时唤出，显示时收起（点控件本身不触发切换）
  document.getElementById('screensaver').addEventListener('click', (e) => {
    if (e.target.closest('.ss-controls')) return;
    const c = document.querySelector('#screensaver .ss-content');
    if (c && c.classList.contains('hide')) showSsControls();
    else hideSsControlsNow();
  });
  function setPlayButton(playing) {
    const btn = document.getElementById('btnPlayPause');
    btn.textContent = playing ? '暂停' : '播放';
    const visual = document.getElementById('playerVisual');
    if (playing) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-ghost');
      visual.classList.add('playing');
    } else {
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn-primary');
      visual.classList.remove('playing');
    }
    const ssBtn = document.getElementById('btnSsPlay');
    if (ssBtn) ssBtn.textContent = playing ? '暂停' : '播放';
  }
  document.getElementById('goalChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    musicGoal = chip.dataset.goal;
    setActiveChip('#goalChips .chip', 'data-goal', chip.dataset.goal);
  });
  document.getElementById('freqChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    musicFreq = chip.dataset.freq;
    setActiveChip('#freqChips .chip', 'data-freq', chip.dataset.freq);
  });
  document.getElementById('durChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    musicDur = +chip.dataset.dur;
    setActiveChip('#durChips .chip', 'data-dur', chip.dataset.dur);
  });
  // 伴奏风格（单选，auto = AI 自动匹配）
  document.getElementById('styleChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    musicStyle = chip.dataset.style;
    setActiveChip('#styleChips .chip', 'data-style', chip.dataset.style);
  });
  // 氛围特效音（多选 toggle）
  document.getElementById('fxChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const fx = chip.dataset.fx;
    if (musicFx.has(fx)) { musicFx.delete(fx); chip.classList.remove('active'); }
    else { musicFx.add(fx); chip.classList.add('active'); }
  });
  function syncFxChips() {
    document.querySelectorAll('#fxChips .chip').forEach(c => c.classList.toggle('active', musicFx.has(c.dataset.fx)));
  }

  async function renderLibrary() {
    const myToken = ++libRenderToken;   // 仅最新一次渲染会真正落盘，旧并发渲染直接放弃
    const presetEl = document.getElementById('presetList');
    const importEl = document.getElementById('importList');
    if (presetEl) presetEl.innerHTML = '';
    if (importEl) importEl.innerHTML = '';
    let tracks = [];
    try { tracks = await MusicStore.getAll(); } catch (e) { tracks = []; }
    if (myToken !== libRenderToken) return;   // 期间已有更新的渲染发起，放弃本次，避免重复追加
    const q = (libQuery || '').trim().toLowerCase();
    const match = (t) => {
      if (libFilter !== 'all' && t.goal !== libFilter) return false;
      if (!q) return true;
      const hay = [t.name, t.goal, t.style, (t.tags || []).join(' '), (t.fx || []).map(f => FX_ZH[f]).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    };
    const presets = tracks.filter(t => t.isPreset && match(t));
    const imports = tracks.filter(t => !t.isPreset && match(t));
    if (presetEl) {
      if (!presets.length) presetEl.innerHTML = '<div class="lib-empty">没有匹配的预置曲，换个关键词试试</div>';
      presets.forEach(t => presetEl.appendChild(buildTrackItem(t, true)));
    }
    if (importEl) {
      if (!imports.length) importEl.innerHTML = '<div class="lib-empty">还没有上传的伴奏，点上方「上传音乐文件」导入 mp3</div>';
      imports.forEach(t => importEl.appendChild(buildTrackItem(t, false)));
    }
  }

  function buildTrackItem(t, isPreset) {
    const div = document.createElement('div');
    div.className = 'music-item';
    const fxTxt = (t.fx && t.fx.length) ? ' · ' + t.fx.map(f => FX_ZH[f]).join('+') : '';
    const freqTxt = t.freq ? t.freq + 'Hz' : '';
    const sub = isPreset ? `${t.goal} · ${t.style} · ${freqTxt}${fxTxt}` : `${t.goal} · 我的伴奏`;
    div.innerHTML = `
      <div class="music-item-icon">${isPreset ? '✨' : '🎵'}</div>
      <div class="music-item-info">
        <div class="music-item-title">${escapeHtml(t.name)}</div>
        <div class="music-item-sub">${escapeHtml(sub)}</div>
      </div>
      ${isPreset ? '' : '<button class="btn btn-ghost btn-sm del-import" data-id="' + t.id + '">删除</button>'}`;
    div.addEventListener('click', (e) => {
      if (e.target.closest('.del-import')) return;
      playTrack(t);
    });
    if (!isPreset) {
      div.querySelector('.del-import').addEventListener('click', async () => {
        await MusicStore.remove(t.id);
        renderLibrary();
        toast('已删除');
      });
    }
    return div;
  }

  function playTrack(t) {
    if (t.params) {
      // 预置曲：合成引擎实时播放（含主题背景切换）
      SynthEngine.stop();
      ScriptureReader.stop();
      const fxTxt = (t.fx && t.fx.length) ? ' · ' + t.fx.map(f => FX_ZH[f]).join(' + ') : '';
      const sub = `${t.goal} · ${t.style} · ${t.freq}Hz${fxTxt}`;
      // 预置曲附带该目标的一段经文（按 id 选段，稳定可复现）
      const seed = (t.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const scripture = pickScripture(t.goal, seed);
      showPlayer('✨', t.name, sub + ' · 可播放或下载', 'synth', { params: t.params, scripture, scriptureAuto: false });
      if (SynthEngine.start(t.params)) setPlayButton(true);
      MusicStore.incPlay(t.id);
      toast('正在播放 ✨');
    } else if (t.blob) {
      playImported(t);
    }
  }

  // ===== 经文伴读（TTS 朗读 + 逐行高亮，无中文嗓音时退化为定时器高亮）=====
  const ScriptureReader = (() => {
    let reading = false;
    let lineEls = [];
    let timer = null;
    function voice() {
      if (!('speechSynthesis' in window)) return null;
      const vs = window.speechSynthesis.getVoices() || [];
      return vs.find(v => /zh|cmn|Chinese/i.test((v.lang || '') + (v.name || ''))) || null;
    }
    function highlight(i) { lineEls.forEach((el, idx) => el.classList.toggle('sr-active', idx === i)); }
    function setBtn(txt) { const b = document.getElementById('btnScripture'); if (b) b.textContent = txt; }
    function stop() {
      reading = false;
      if (timer) { clearTimeout(timer); timer = null; }
      if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      lineEls.forEach(el => el.classList.remove('sr-active'));
      setBtn('🔊 朗读');
    }
    function read(lines) {
      stop();
      lineEls = Array.from(document.querySelectorAll('#scriptureText .sr-line'));
      if (!lines || !lines.length) return false;
      reading = true; setBtn('⏸ 停止');
      const synth = window.speechSynthesis;
      if (synth && voice()) {
        let i = 0;
        const next = () => {
          if (!reading) return;
          if (i >= lines.length) { stop(); return; }
          highlight(i);
          const u = new SpeechSynthesisUtterance(lines[i]);
          u.lang = 'zh-CN'; const v = voice(); if (v) u.voice = v;
          u.rate = 0.9; u.pitch = 1.0;
          u.onend = () => { if (!reading) return; i++; next(); };
          u.onerror = () => { if (!reading) return; i++; next(); };
          try { synth.speak(u); } catch (e) { if (!reading) return; i++; next(); }
        };
        next();
        return true;
      }
      // 退化：无中文嗓音时按行定时高亮（无声但可见）
      let i = 0;
      const step = () => {
        if (!reading) return;
        highlight(i);
        if (++i >= lines.length) { stop(); return; }
        timer = setTimeout(step, 3200);
      };
      step();
      return true;
    }
    return {
      render(lines) {
        const box = document.getElementById('scriptureBox');
        const txt = document.getElementById('scriptureText');
        if (!box || !txt) return;
        if (!lines || !lines.length) { box.style.display = 'none'; txt.innerHTML = ''; return; }
        txt.innerHTML = lines.map(l => '<div class="sr-line">' + escapeHtml(l) + '</div>').join('');
        box.style.display = 'block';
        setBtn('🔊 朗读');
      },
      start(lines) { return read(lines); },
      toggle(lines) { if (reading) { stop(); return false; } return read(lines); },
      stop,
      isReading() { return reading; }
    };
  })();

  function showPlayer(icon, title, sub, type, extra) {
    ScriptureReader.stop();   // 切歌先停掉上一段经文朗读
    const card = document.getElementById('playerCard');
    card.style.display = 'block';
    document.getElementById('playerVisual').textContent = icon;
    document.getElementById('playerTitle').textContent = title;
    document.getElementById('playerSub').textContent = sub;
    // 按主题切换动态背景（爱情粉 / 财富金 / 健康绿 / 平静蓝 / 事业青）
    const goal = type === 'import'
      ? (extra && extra.goal)
      : (extra && extra.params && extra.params.goal);
    applyTheme(goal);
    if (type === 'import') {
      currentTrack = { type: 'import', icon, title, sub, file: extra.file, scripture: extra.scripture || [], scriptureAuto: false };
      document.getElementById('playerNote').textContent = '正在播放你导入的伴奏（循环播放）· 可下载原文件';
    } else {
      currentTrack = { type: 'synth', icon, title, sub, params: extra.params, scripture: extra.scripture || [], scriptureAuto: !!extra.scriptureAuto };
      document.getElementById('playerNote').textContent = '已合成疗愈音乐：改编名曲/原创旋律 + 和弦伴奏 + 极轻治愈频率打底，可播放或下载 30 秒试听片段';
    }
    ScriptureReader.render(currentTrack.scripture);
    if (currentTrack.scriptureAuto && currentTrack.scripture.length) {
      setTimeout(() => { if (currentTrack && currentTrack.scriptureAuto) ScriptureReader.start(currentTrack.scripture); }, 120);
    }
    setPlayButton(false);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 生成定制音乐（AI 理解愿望提示词 → 匹配目标/风格/特效 → 真实合成）
  document.getElementById('musicForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const customName = document.getElementById('musicName').value.trim();
    const wishText = document.getElementById('wishPrompt').value.trim();
    const btn = document.getElementById('btnGenerate');
    btn.disabled = true;

    function finalize(aiHit) {
      btn.disabled = false;
      btn.textContent = '生成我的定制音乐';
      const meta = GOAL_META[musicGoal] || { icon: '🎧', tip: '专属频率已就绪' };
      // 用户手动选择优先；未选部分由 AI 推荐补齐
      let styleName = musicStyle === 'auto' ? null : musicStyle;
      let fxList = Array.from(musicFx);
      let aiNote = null;
      if (aiHit) {
        styleName = styleName || aiHit.style;
        if (fxList.length === 0) {
          fxList = aiHit.fx.slice();
          musicFx = new Set(fxList);
          syncFxChips(); // AI 推荐的特效音同步点亮，用户可见
        }
        aiNote = `AI 读懂了「${wishText}」→ ${aiHit.goal}主题 · ${styleName}风格${fxList.length ? ' · ' + fxList.map(f => FX_ZH[f]).join(' + ') : ''}。${aiHit.reply}`;
      } else if (wishText) {
        aiNote = `AI 没有完全读懂「${wishText}」，已按你选择的「${musicGoal}」生成；提示词里可以写「赚钱」「脱单」「睡个好觉」这类关键词，AI 就能精准定制`;
      }
      const freq = +musicFreq;
      const beat = BEAT_BY_GOAL[musicGoal] || 8;
      const params = SynthEngine.makeParams(musicGoal, freq, beat, { styleName, fx: fxList, wish: wishText });
      const fxTag = params.fxLabels.length ? ' · ' + params.fxLabels.join(' + ') : '';
      const sub = `${musicFreq}Hz · ${params.styleName} · ${params.melody.label}${fxTag} · ${musicDur} 分钟 · ${aiNote ? 'AI 已理解你的愿望' : meta.tip}`;
      // 经文伴读：勾选时按目标取一段经文，并随播放自动诵读
      const withScr = document.getElementById('withScripture') && document.getElementById('withScripture').checked;
      const scripture = withScr ? pickScripture(musicGoal, (freq * 7 + beat * 13 + (wishText ? wishText.length : 0))) : [];
      showPlayer(meta.icon, customName || `定制 Sub · ${musicGoal}`, sub, 'synth', { params, scripture, scriptureAuto: withScr });
      if (aiNote) document.getElementById('playerNote').textContent = '🪄 ' + aiNote;
      toast(aiNote ? 'AI 定制完成 ✨' : '定制音乐已生成 ✨');
    }

    if (wishText) {
      // AI 理解愿望：识别意图 → 目标跟随意图，风格/特效未手动选时用推荐
      btn.textContent = 'AI 正在理解你的愿望…';
      setTimeout(() => {
        const hit = interpretWish(wishText);
        if (hit) {
          musicGoal = hit.goal;
          setActiveChip('#goalChips .chip', 'data-goal', hit.goal);
        }
        finalize(hit);
      }, 900);
    } else {
      btn.textContent = '正在合成中…';
      setTimeout(() => finalize(null), 600);
    }
  });

  document.getElementById('btnPlayPause').addEventListener('click', () => {
    if (!currentTrack) { toast('先点「生成」或选一首伴奏再播放哦'); return; }
    if (currentTrack.type === 'import') {
      const a = importAudio;
      if (!a) { toast('请重新选择伴奏'); return; }
      if (!a.paused) {
        a.pause();
        setPlayButton(false);
        ScriptureReader.stop();
      } else {
        a.play().then(() => setPlayButton(true)).catch(() => toast('播放失败，请重试'));
      }
      return;
    }
    if (SynthEngine.isPlaying()) {
      SynthEngine.stop();
      setPlayButton(false);
      ScriptureReader.stop();
    } else {
      if (SynthEngine.start(currentTrack.params)) {
        setPlayButton(true);
        toast('正在播放 ✨');
        if (currentTrack.scriptureAuto && currentTrack.scripture && currentTrack.scripture.length) ScriptureReader.start(currentTrack.scripture);
      } else {
        toast('当前浏览器不支持音频合成');
      }
    }
  });

  // 经文伴读：手动朗读 / 停止（独立于音乐，可单独诵读）
  document.getElementById('btnScripture').addEventListener('click', () => {
    if (!currentTrack || !currentTrack.scripture || !currentTrack.scripture.length) { toast('这首没有附带经文哦'); return; }
    ScriptureReader.toggle(currentTrack.scripture);
  });

  // ===== 塔罗 · 牌阵解读（选排阵 → 去洗牌 → 78 张亲手抽牌 → 排阵解读；牌面 SVG 参考韦特塔罗）=====
  let tarotSpreadKey = 'time';
  let tarotState = null;   // { spread, positions:[{card,reversed,revealed}] }
  let tarotQuestion = '';
  let tarotPhase = 'setup';   // setup | draw | result
  let tarotDraw = null;       // { order:[idx...], drawn:[bool×78], picks:{}, n, count }
  const tarotQEl = document.getElementById('tarotQuestion');
  if (tarotQEl) tarotQEl.addEventListener('input', () => { tarotQuestion = tarotQEl.value.trim(); });

  const SUIT_COLOR = { wands: '#c1773a', cups: '#3f86b8', swords: '#7d8590', pentacles: '#b8893b' };

  // 五角星路径点（星币用）
  function starPoints(cx, cy, outer, inner, n) {
    const p = [];
    for (let i = 0; i < n * 2; i++) {
      const r = (i % 2 === 0) ? outer : inner;
      const a = -Math.PI / 2 + i * Math.PI / n;
      p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }
  // 花色矢量符号（权杖/圣杯/宝剑/星币）
  function tarotSuitSVG(suit, cx, cy, s, color) {
    const k = s / 40; const col = color || '#b8893b';
    if (suit === 'wands') {
      return `<g stroke="${col}" stroke-width="${2.4 * k}" fill="none" stroke-linecap="round">
        <line x1="${cx}" y1="${cy + 34 * k}" x2="${cx}" y2="${cy - 30 * k}"/>
        <path d="M${cx - 14 * k} ${cy - 4 * k} L${cx} ${cy - 22 * k} L${cx + 14 * k} ${cy - 4 * k}"/>
        <circle cx="${cx}" cy="${cy - 34 * k}" r="${3.4 * k}" fill="${col}"/>
      </g>`;
    }
    if (suit === 'cups') {
      return `<g fill="none" stroke="${col}" stroke-width="${2.4 * k}" stroke-linejoin="round">
        <path d="M${cx - 20 * k} ${cy - 18 * k} Q ${cx} ${cy + 8 * k} ${cx + 20 * k} ${cy - 18 * k} Z" fill="${col}" fill-opacity="0.12"/>
        <line x1="${cx}" y1="${cy + 2 * k}" x2="${cx}" y2="${cy + 22 * k}"/>
        <line x1="${cx - 12 * k}" y1="${cy + 24 * k}" x2="${cx + 12 * k}" y2="${cy + 24 * k}"/>
      </g>`;
    }
    if (suit === 'swords') {
      return `<g stroke="${col}" stroke-width="${2.4 * k}" fill="none" stroke-linecap="round">
        <line x1="${cx}" y1="${cy + 34 * k}" x2="${cx}" y2="${cy - 34 * k}"/>
        <line x1="${cx - 16 * k}" y1="${cy - 14 * k}" x2="${cx + 16 * k}" y2="${cy - 14 * k}"/>
        <circle cx="${cx}" cy="${cy - 40 * k}" r="${3 * k}" fill="${col}"/>
      </g>`;
    }
    const pts = starPoints(cx, cy, 22 * k, 9 * k, 5);
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${26 * k}" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-width="${2.2 * k}"/>
      <polygon points="${pts}" fill="${col}" fill-opacity="0.85"/>
    </g>`;
  }
  // 大阿尔卡纳牌面场景（参考韦特塔罗意象，简化绘制）
  function majorScene(idx) {
    const S = '#e9c39a', PUR = '#8a6fb0', G = '#b8893b';
    const sun = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f3c14b"/>` + [...Array(8)].map((_, k) => { const a = k * Math.PI / 4; return `<line x1="${(x + Math.cos(a) * (r + 3)).toFixed(1)}" y1="${(y + Math.sin(a) * (r + 3)).toFixed(1)}" x2="${(x + Math.cos(a) * (r + 12)).toFixed(1)}" y2="${(y + Math.sin(a) * (r + 12)).toFixed(1)}" stroke="#e09b2e" stroke-width="2"/>`; }).join('');
    const fig = (x, y, robe) => `<circle cx="${x}" cy="${y}" r="12" fill="${S}"/><path d="M${x - 15} ${y + 42} Q ${x} ${y + 6} ${x + 15} ${y + 42} Z" fill="${robe}"/>`;
    const moon = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e9eef5"/><path d="M${x + 4} ${y - r} A ${r} ${r} 0 1 0 ${x + 4} ${y + r} A ${r - 5} ${r - 5} 0 1 1 ${x + 4} ${y - r} Z" fill="#cdd6e2"/>`;
    const star8 = (x, y, r) => { let p = ''; for (let k = 0; k < 16; k++) { const rr = k % 2 ? r * 0.45 : r; const a = -Math.PI / 2 + k * Math.PI / 8; p += `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)} `; } return `<polygon points="${p}" fill="#f3c14b"/>`; };
    switch (idx) {
      case 0: return `${sun(40, 78, 14)}<path d="M118 248 L158 248 L158 200 Z" fill="#c9a36b"/><circle cx="78" cy="150" r="12" fill="${S}"/><path d="M64 192 Q78 166 92 192 Z" fill="${PUR}"/><circle cx="102" cy="202" r="5" fill="#9b7bbf"/>`;
      case 1: return `<path d="M68 68 q22 -14 44 0" stroke="${G}" stroke-width="3" fill="none"/><line x1="90" y1="58" x2="90" y2="120" stroke="${G}" stroke-width="3"/><circle cx="90" cy="138" r="12" fill="${S}"/><path d="M76 180 Q90 156 104 180 Z" fill="${PUR}"/><rect x="62" y="198" width="56" height="14" rx="3" fill="#cbb08a"/>`;
      case 2: return `<rect x="40" y="70" width="14" height="160" rx="4" fill="#cdbfa6"/><rect x="126" y="70" width="14" height="160" rx="4" fill="#cdbfa6"/><rect x="34" y="64" width="26" height="12" rx="3" fill="${G}"/><rect x="120" y="64" width="26" height="12" rx="3" fill="${G}"/><circle cx="90" cy="150" r="13" fill="${S}"/><path d="M74 196 Q90 168 106 196 Z" fill="#9b7bbf"/><path d="M82 234 a8 8 0 1 0 16 0" fill="none" stroke="#b9bcc4" stroke-width="2"/>`;
      case 3: { const stars = [...Array(11)].map((_, k) => { const a = Math.PI * (0.12 + 0.76 * k / 10); const x = 90 + Math.sin(a) * 44; const y = 80 - Math.cos(a) * 30; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#f3c14b"/>`; }).join(''); return `${stars}<circle cx="90" cy="132" r="13" fill="${S}"/><path d="M74 180 Q90 152 106 180 Z" fill="#c98bb0"/><path d="M70 176 q20 12 40 0" stroke="#7bbf6a" stroke-width="3" fill="none"/>`; }
      case 4: return `<rect x="58" y="122" width="64" height="108" rx="6" fill="#9a7b5a"/><rect x="52" y="114" width="76" height="14" rx="4" fill="#7a5b3a"/><circle cx="90" cy="150" r="13" fill="${S}"/><path d="M74 196 Q90 168 106 196 Z" fill="#7a5b3a"/><circle cx="60" cy="150" r="4" fill="#6b4f33"/><circle cx="120" cy="150" r="4" fill="#6b4f33"/>`;
      case 5: return `<line x1="120" y1="70" x2="120" y2="210" stroke="${G}" stroke-width="3"/><line x1="112" y1="86" x2="128" y2="86" stroke="${G}" stroke-width="3"/><line x1="112" y1="100" x2="128" y2="100" stroke="${G}" stroke-width="3"/><circle cx="90" cy="132" r="13" fill="${S}"/><path d="M74 180 Q90 152 106 180 Z" fill="#cbb08a"/><path d="M66 206 l0 -16 M60 198 l12 0" stroke="${G}" stroke-width="2"/><path d="M114 206 l0 -16 M108 198 l12 0" stroke="${G}" stroke-width="2"/><circle cx="64" cy="180" r="6" fill="${S}"/><circle cx="116" cy="180" r="6" fill="${S}"/>`;
      case 6: return `${sun(90, 72, 15)}<circle cx="70" cy="162" r="11" fill="${S}"/><path d="M58 202 Q70 178 82 202 Z" fill="#b58bd0"/><circle cx="110" cy="162" r="11" fill="${S}"/><path d="M98 202 Q110 178 122 202 Z" fill="#c98bb0"/>`;
      case 7: return `<rect x="56" y="158" width="68" height="42" rx="6" fill="${PUR}"/><circle cx="66" cy="204" r="8" fill="#7a5b3a"/><circle cx="114" cy="204" r="8" fill="#7a5b3a"/><circle cx="90" cy="130" r="12" fill="${S}"/><path d="M76 160 Q90 138 104 160 Z" fill="#9b7bbf"/><circle cx="58" cy="148" r="9" fill="#e9c39a"/><circle cx="122" cy="148" r="9" fill="#e9c39a"/><text x="90" y="92" text-anchor="middle" font-size="11" fill="${G}">✦ ✦ ✦</text>`;
      case 8: return `<circle cx="90" cy="148" r="12" fill="${S}"/><path d="M74 196 Q90 168 106 196 Z" fill="#c98bb0"/><circle cx="90" cy="118" r="22" fill="#e0b15a"/><circle cx="80" cy="114" r="9" fill="#caa" opacity=".6"/><circle cx="100" cy="114" r="9" fill="#caa" opacity=".6"/><path d="M82 150 q8 8 16 0" stroke="#6b4f33" stroke-width="2" fill="none"/>`;
      case 9: return `<line x1="118" y1="78" x2="100" y2="220" stroke="#7a5b3a" stroke-width="4"/><circle cx="80" cy="142" r="12" fill="${S}"/><path d="M66 188 Q80 162 94 188 Z" fill="#9b9bbf"/><circle cx="62" cy="120" r="10" fill="#f3c14b"/><circle cx="62" cy="120" r="4" fill="#fff"/>`;
      case 10: return `<circle cx="90" cy="150" r="46" fill="none" stroke="${G}" stroke-width="3"/><circle cx="90" cy="150" r="30" fill="none" stroke="${G}" stroke-width="2"/><line x1="90" y1="104" x2="90" y2="196" stroke="${G}"/><line x1="44" y1="150" x2="136" y2="150" stroke="${G}"/><circle cx="90" cy="104" r="6" fill="#9b7bbf"/><circle cx="136" cy="150" r="6" fill="#9b7bbf"/><circle cx="90" cy="196" r="6" fill="#9b7bbf"/>`;
      case 11: return `<line x1="90" y1="92" x2="90" y2="200" stroke="#9b9bbf" stroke-width="3"/><line x1="78" y1="100" x2="102" y2="100" stroke="#9b9bbf" stroke-width="3"/><path d="M62 132 L90 118 L118 132" stroke="${G}" stroke-width="2" fill="none"/><line x1="90" y1="118" x2="90" y2="144" stroke="${G}"/><circle cx="62" cy="132" r="5" fill="${G}"/><circle cx="118" cy="132" r="5" fill="${G}"/><circle cx="90" cy="162" r="11" fill="${S}"/><path d="M76 200 Q90 176 104 200 Z" fill="#9b7bbf"/>`;
      case 12: return `<line x1="60" y1="70" x2="120" y2="70" stroke="#7a5b3a" stroke-width="4"/><line x1="90" y1="70" x2="90" y2="100" stroke="#7a5b3a" stroke-width="4"/><circle cx="90" cy="212" r="12" fill="${S}"/><path d="M78 168 Q90 196 102 168 Z" fill="${PUR}"/><line x1="66" y1="200" x2="60" y2="170" stroke="${PUR}" stroke-width="3"/><line x1="114" y1="200" x2="120" y2="170" stroke="${PUR}" stroke-width="3"/>`;
      case 13: return `<path d="M70 150 q22 -12 42 0 l-4 42 q-17 8 -34 0 Z" fill="#7a5b3a"/><circle cx="62" cy="138" r="9" fill="#e9eef5"/><line x1="56" y1="118" x2="68" y2="118" stroke="#666" stroke-width="3"/><line x1="112" y1="118" x2="112" y2="78" stroke="#666" stroke-width="2"/><path d="M112 80 L130 88 L112 96 Z" fill="#9b7bbf"/>`;
      case 14: return `<circle cx="90" cy="128" r="12" fill="${S}"/><path d="M74 174 Q90 146 106 174 Z" fill="#cfe3f2"/><path d="M58 200 q12 -22 24 0" stroke="${G}" stroke-width="2" fill="none"/><path d="M98 200 q12 -22 24 0" stroke="${G}" stroke-width="2" fill="none"/><path d="M68 216 q22 10 44 0" stroke="#5b8ed0" stroke-width="2" fill="none"/>`;
      case 15: return `<path d="M78 96 L82 84 L90 92 L98 84 L102 96 Z" fill="#7a3b3b"/><circle cx="90" cy="120" r="13" fill="#caa"/><path d="M74 166 Q90 140 106 166 Z" fill="#7a3b3b"/><circle cx="70" cy="196" r="7" fill="${S}"/><circle cx="110" cy="196" r="7" fill="${S}"/><line x1="70" y1="203" x2="110" y2="203" stroke="#777"/><path d="M90 70 l-8 12 8 4 8 -4 Z" fill="#9b7bbf"/>`;
      case 16: return `<rect x="74" y="120" width="32" height="100" rx="3" fill="#b89a6b"/><rect x="68" y="112" width="44" height="12" rx="3" fill="#a8895a"/><path d="M100 78 L88 120 L96 118 L82 152" stroke="#f3c14b" stroke-width="3" fill="none"/><path d="M78 116 l8 -8 4 8 8 -8" fill="#e0736b"/><circle cx="68" cy="150" r="6" fill="${S}"/><circle cx="112" cy="160" r="6" fill="${S}"/>`;
      case 17: return `${star8(90, 96, 22)}<circle cx="60" cy="120" r="3" fill="#f3c14b"/><circle cx="120" cy="120" r="3" fill="#f3c14b"/><circle cx="70" cy="150" r="2.5" fill="#f3c14b"/><circle cx="110" cy="150" r="2.5" fill="#f3c14b"/><circle cx="90" cy="170" r="11" fill="${S}"/><path d="M76 212 Q90 188 104 212 Z" fill="#cfe3f2"/><path d="M70 214 q-6 8 -2 16" stroke="#5b8ed0" stroke-width="2" fill="none"/><path d="M110 214 q6 8 2 16" stroke="#5b8ed0" stroke-width="2" fill="none"/>`;
      case 18: return `${moon(90, 92, 22)}<rect x="50" y="150" width="16" height="60" fill="#9b8fb0"/><rect x="114" y="150" width="16" height="60" fill="#9b8fb0"/><path d="M90 212 q-14 -10 0 -26 q14 16 0 26" stroke="#cbb08a" fill="none"/><circle cx="64" cy="200" r="7" fill="#7a6b5a"/><circle cx="116" cy="200" r="7" fill="#7a6b5a"/><path d="M84 224 q6 6 12 0" stroke="#c1773a" stroke-width="2" fill="none"/>`;
      case 19: return `${sun(90, 90, 26)}<circle cx="90" cy="162" r="10" fill="${S}"/><path d="M78 202 Q90 180 102 202 Z" fill="#f3c14b"/><rect x="74" y="198" width="32" height="8" rx="4" fill="#9b7bbf"/><line x1="56" y1="216" x2="56" y2="190" stroke="#7bbf6a" stroke-width="2"/><circle cx="56" cy="186" r="6" fill="#f3c14b"/><line x1="124" y1="216" x2="124" y2="190" stroke="#7bbf6a" stroke-width="2"/><circle cx="124" cy="186" r="6" fill="#f3c14b"/><rect x="40" y="216" width="100" height="14" rx="4" fill="#cdb68a" opacity=".6"/>`;
      case 20: return `<circle cx="90" cy="100" r="12" fill="${S}"/><path d="M76 140 Q90 116 104 140 Z" fill="#cfe3f2"/><line x1="104" y1="96" x2="132" y2="80" stroke="#f3c14b" stroke-width="3"/><path d="M132 72 l10 2 -8 8 Z" fill="#f3c14b"/><rect x="64" y="200" width="14" height="22" rx="3" fill="#b89a6b"/><rect x="86" y="195" width="14" height="27" rx="3" fill="#b89a6b"/><rect x="108" y="200" width="14" height="22" rx="3" fill="#b89a6b"/><circle cx="71" cy="196" r="5" fill="${S}"/><circle cx="93" cy="191" r="5" fill="${S}"/><circle cx="115" cy="196" r="5" fill="${S}"/>`;
      case 21: return `<ellipse cx="90" cy="155" rx="48" ry="64" fill="none" stroke="#7bbf6a" stroke-width="3"/><circle cx="90" cy="155" r="13" fill="${S}"/><path d="M74 200 Q90 175 106 200 Z" fill="#c98bb0"/><circle cx="44" cy="100" r="6" fill="#9b7bbf"/><circle cx="136" cy="100" r="6" fill="#9b7bbf"/><circle cx="44" cy="210" r="6" fill="#9b7bbf"/><circle cx="136" cy="210" r="6" fill="#9b7bbf"/>`;
      default: return `<text x="90" y="160" text-anchor="middle" font-size="40" fill="${G}">✦</text>`;
    }
  }
  // 小阿尔卡纳：数字牌按 pip 布局摆花色；宫廷牌画人物
  function pipPositions(n) {
    const L = 52, R = 128, M = 90, T = 100, B = 210;
    switch (n) {
      case 1: return [[M, 155]];
      case 2: return [[M, T], [M, B]];
      case 3: return [[M, T], [M, 155], [M, B]];
      case 4: return [[L, T], [R, T], [L, B], [R, B]];
      case 5: return [[L, T], [R, T], [M, 155], [L, B], [R, B]];
      case 6: return [[L, T], [M, T], [R, T], [L, B], [M, B], [R, B]];
      case 7: return [[L, T], [M, T], [R, T], [M, 155], [L, B], [M, B], [R, B]];
      case 8: return [[L, T], [R, T], [L, 127], [R, 127], [L, 183], [R, 183], [L, B], [R, B]];
      case 9: return [[L, T], [M, T], [R, T], [L, 155], [M, 155], [R, 155], [L, B], [M, B], [R, B]];
      case 10: { const a = []; for (let k = 0; k < 5; k++) { const y = 92 + k * 29; a.push([L, y], [R, y]); } return a; }
      default: return [[M, 155]];
    }
  }
  function minorScene(card) {
    const color = SUIT_COLOR[card.suit] || '#b8893b';
    const S = '#e9c39a';
    if (card.num <= 10) {
      return pipPositions(card.num).map(([x, y]) => tarotSuitSVG(card.suit, x, y, 30, color)).join('');
    }
    const robe = color; const crown = card.num >= 13; const isKing = card.num === 14;
    let s = `<circle cx="90" cy="120" r="15" fill="${S}"/>`;
    if (crown) s += `<path d="M78 108 L84 98 L90 106 L96 98 L102 108 Z" fill="#e9b94b"/>`;
    if (isKing) s += `<path d="M80 138 Q90 132 100 138" stroke="#caa" stroke-width="2" fill="none"/>`;
    s += `<path d="M64 212 Q90 132 116 212 Z" fill="${robe}" fill-opacity="0.92"/>`;
    s += tarotSuitSVG(card.suit, 120, 152, 30, color);
    return s;
  }
  // 单张牌 SVG（花边边框 + 牌名 + 罗马数字 + 场景）
  function tarotCardSVG(item) {
    const c = item.card, rev = item.reversed;
    const border = '#b8893b', border2 = '#8a6326', ink = '#3a2a1a', bg1 = '#fcf6e8', bg2 = '#f1e0c4';
    const scene = c.kind === 'major' ? majorScene(c.num - 1) : minorScene(c);
    const inner = `
      <rect x="12" y="12" width="156" height="276" rx="14" fill="${bg1}" stroke="${border}" stroke-width="3"/>
      <rect x="20" y="20" width="140" height="260" rx="9" fill="${bg2}" fill-opacity="0.5" stroke="${border}" stroke-width="1.2" stroke-opacity="0.55"/>
      <rect x="24" y="24" width="132" height="30" rx="7" fill="${border}" fill-opacity="0.14"/>
      <text x="90" y="44" text-anchor="middle" font-size="15" font-weight="700" fill="${ink}">${escapeHtml(c.name)}</text>
      <g class="tarot-scene">${scene}</g>
      <text x="90" y="276" text-anchor="middle" font-size="17" font-weight="700" fill="${border2}" letter-spacing="1.5">${c.roman}</text>
      <text x="28" y="20" font-size="11" fill="${border}" opacity="0.8">✦</text>
      <text x="152" y="20" font-size="11" fill="${border}" opacity="0.8" text-anchor="end">✦</text>
      <text x="28" y="293" font-size="11" fill="${border}" opacity="0.8">✦</text>
      <text x="152" y="293" font-size="11" fill="${border}" opacity="0.8" text-anchor="end">✦</text>`;
    const rot = rev ? ' transform="rotate(180 90 150)"' : '';
    return `<svg class="tarot-svg" viewBox="0 0 180 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(c.name)} ${rev ? '逆位' : '正位'}"><g${rot}>${inner}</g></svg>`;
  }
  // 排阵综合解读（参考位置，而非单张孤立解读）
  function tarotSpreadReading(question, spread, picks) {
    const q = (question || '').trim();
    const qc = q ? (q.length > 22 ? q.slice(0, 22) + '…' : q) : '';
    let out = '';
    if (qc) out += `就你的问题「${escapeHtml(qc)}」，牌阵这样回应你：\n\n`;
    else out += `这是一组关于「${spread.name}」的指引：\n\n`;
    picks.forEach((p, i) => {
      const role = spread.roles[i], hint = spread.roleHint[i];
      const orient = p.reversed ? '逆位' : '正位';
      const mean = p.reversed ? p.card.reversed : p.card.upright;
      out += `【${role} · ${p.card.name}${orient}】\n${mean}（这一张落在「${role}」：${hint}）\n\n`;
    });
    const names = picks.map(p => `${p.card.name}${p.reversed ? '逆' : ''}`).join('、');
    out += `整体来看，${names} 串起一条线：`;
    if (qc) out += `把目光放回「${escapeHtml(qc)}」——过去给了你底色，现在是你最能着力之处，未来提示了柔软调整的方向。不必一次解决，先稳住当下这一张，其余会自然展开。`;
    else out += `过去是来路，现在是着力点，未来是松动的可能。先接住「现在」这张牌的信号，其余会自然展开。`;
    return out;
  }
  function upHTML(p, i) {
    return `<div class="tarot-up" data-i="${i}">${tarotCardSVG(p)}<div class="tarot-up-name">${escapeHtml(p.card.name)} <span class="orient ${p.reversed ? 'rev' : ''}">${p.reversed ? '逆位' : '正位'}</span></div></div>`;
  }
  function renderPositions() {
    const box = document.getElementById('tarotPositions');
    if (!box || !tarotState) return;
    const spread = tarotState.spread;
    const tag = document.getElementById('posCardTag');
    if (tag) tag.textContent = '牌阵 · ' + spread.name;
    box.innerHTML = tarotState.positions.map((p, i) => `<div class="tarot-pos" id="pos-${i}"><div class="tarot-pos-label">${spread.roles[i]}</div><div class="tarot-card-wrap">${upHTML(p, i)}</div></div>`).join('');
    box.querySelectorAll('.tarot-up').forEach(el => el.addEventListener('click', () => openLightbox(tarotState.positions[+el.dataset.i])));
  }
  function renderRead() {
    const read = document.getElementById('tarotRead');
    if (!read || !tarotState) return;
    if (!tarotState.positions.length) { read.style.display = 'none'; read.innerHTML = ''; return; }
    const spread = tarotState.spread;
    const cards = tarotState.positions.map((p, i) => `<div class="tarot-big"><div class="tarot-big-svg">${tarotCardSVG(p)}</div><div class="tarot-big-role">${spread.roles[i]}</div><div class="tarot-big-name">${escapeHtml(p.card.name)} <span class="orient ${p.reversed ? 'rev' : ''}">${p.reversed ? '逆位' : '正位'}</span></div></div>`).join('');
    const reading = tarotSpreadReading(tarotQuestion, spread, tarotState.positions);
    read.innerHTML = `<div class="card-tag">排阵解读</div><div class="tarot-big-row">${cards}</div><div class="tarot-reading">${reading.split('\n').map(l => l.trim() ? `<p>${l}</p>` : '').join('')}</div>`;
    read.style.display = 'block';
  }
  function openLightbox(item) {
    const lb = document.getElementById('tarotLightbox');
    if (!lb) return;
    lb.querySelector('.lb-body').innerHTML = tarotCardSVG(item) + `<div class="lb-name">${escapeHtml(item.card.name)} ${item.reversed ? '逆位' : '正位'}</div>`;
    lb.style.display = 'flex';
  }
  // 抽牌进度
  function updateProgress() {
    if (!tarotDraw) return;
    const fill = document.getElementById('tarotProgressFill');
    const label = document.getElementById('tarotProgressLabel');
    if (fill) fill.style.width = (tarotDraw.count / tarotDraw.n * 100) + '%';
    if (label) label.textContent = `已抽 ${tarotDraw.count} / ${tarotDraw.n}`;
  }
  // 渲染 78 张牌背网格（已抽的牌当场翻开显示）
  function renderDeckGrid() {
    const grid = document.getElementById('tarotDeckGrid');
    if (!grid || !tarotDraw) return;
    grid.innerHTML = tarotDraw.order.map(cardIdx => {
      const item = tarotDraw.picks[cardIdx];
      if (item) {
        return `<button type="button" class="tarot-deck-card drawn" disabled aria-label="${escapeHtml(item.card.name)}">${tarotCardSVG(item)}<span class="tarot-deck-check">✓</span></button>`;
      }
      return `<button type="button" class="tarot-deck-card" data-card="${cardIdx}" aria-label="抽这张牌"><span class="tarot-deck-back"><span class="tarot-deck-mark">✦</span></span></button>`;
    }).join('');
    grid.querySelectorAll('.tarot-deck-card[data-card]').forEach(el => el.addEventListener('click', () => drawCard(+el.dataset.card)));
  }
  // 用户亲手从 78 张里抽一张（顺序对应排阵位置）
  function drawCard(cardIdx) {
    if (!tarotDraw || tarotDraw.drawn[cardIdx] || tarotDraw.count >= tarotDraw.n) return;
    const card = TAROT_DECK[cardIdx];
    const item = { card, reversed: Math.random() < 0.5, revealed: true };
    tarotDraw.drawn[cardIdx] = true;
    tarotDraw.picks[cardIdx] = item;
    tarotDraw.count++;
    tarotState.positions.push(item);
    updateProgress();
    renderDeckGrid();
    if (tarotDraw.count >= tarotDraw.n) setTimeout(showResult, 420);
  }
  // 进入抽牌阶段（洗牌：重排 78 张顺序，由用户亲手抽）
  function startDraw() {
    const spread = TAROT_SPREADS[tarotSpreadKey] || TAROT_SPREADS.time;
    const n = spread.roles.length;
    const order = TAROT_DECK.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    tarotDraw = { order, drawn: new Array(TAROT_DECK.length).fill(false), picks: {}, n, count: 0 };
    tarotState = { spread, positions: [] };
    tarotPhase = 'draw';
    showTarotPhase();
    const tag = document.getElementById('tarotDrawTag');
    if (tag) tag.textContent = '从 78 张里抽 ' + n + ' 张 · ' + spread.name;
    updateProgress();
    renderDeckGrid();
    toast(tarotQuestion ? '凭直觉抽牌吧 ✨' : '已洗牌～凭直觉抽牌，有问题会更准 ✨');
  }
  function showTarotPhase() {
    const setup = document.getElementById('tarotSetup');
    const draw = document.getElementById('tarotDraw');
    const result = document.getElementById('tarotResult');
    const back = document.getElementById('tarotBack');
    if (setup) setup.style.display = tarotPhase === 'setup' ? 'block' : 'none';
    if (draw) draw.style.display = tarotPhase === 'draw' ? 'block' : 'none';
    if (result) result.style.display = tarotPhase === 'result' ? 'block' : 'none';
    if (back) back.style.display = tarotPhase === 'setup' ? 'none' : 'inline-flex';
    const read = document.getElementById('tarotRead');
    if (read && tarotPhase !== 'result') { read.style.display = 'none'; read.innerHTML = ''; }
    const posBox = document.getElementById('tarotPositions');
    if (posBox && tarotPhase !== 'result') posBox.innerHTML = '';
  }
  function showResult() {
    if (!tarotState) return;
    tarotPhase = 'result';
    showTarotPhase();
    renderPositions();
    renderRead();
    toast('牌已翻开，看看牌阵想对你说什么 ✨');
  }
  function resetTarot() {
    tarotPhase = 'setup';
    tarotDraw = null;
    tarotState = null;
    const read = document.getElementById('tarotRead');
    if (read) { read.style.display = 'none'; read.innerHTML = ''; }
    showTarotPhase();
  }
  document.querySelectorAll('#spreadChips .spread-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#spreadChips .spread-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      tarotSpreadKey = chip.dataset.spread;
    });
  });
  document.getElementById('btnShuffle').addEventListener('click', startDraw);
  document.getElementById('btnReshuffle').addEventListener('click', startDraw);
  document.getElementById('btnRedraw').addEventListener('click', startDraw);
  document.getElementById('btnBackSetup').addEventListener('click', () => { tarotPhase = 'setup'; showTarotPhase(); });
  document.getElementById('tarotBack').addEventListener('click', () => { tarotPhase = 'setup'; showTarotPhase(); });
  const lbEl = document.getElementById('tarotLightbox');
  if (lbEl) lbEl.addEventListener('click', e => { if (e.target.id === 'tarotLightbox') e.currentTarget.style.display = 'none'; });

  document.getElementById('btnDownload').addEventListener('click', async () => {
    if (!currentTrack) { toast('先点「生成」或选一首伴奏再下载哦'); return; }
    const btn = document.getElementById('btnDownload');
    btn.disabled = true;
    btn.textContent = '正在导出…';
    try {
      if (currentTrack.type === 'import') {
        // 直接下载导入的原文件
        const url = URL.createObjectURL(currentTrack.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentTrack.file.name || (currentTrack.title || '伴奏') + '.mp3';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('已下载伴奏');
      } else {
        const blob = await SynthEngine.renderWav(currentTrack.params, 30);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = (currentTrack.title || '定制sub') + '.wav';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast('已导出 30 秒试听片段');
        } else {
          toast('当前浏览器不支持导出');
        }
      }
    } catch (err) {
      toast('导出失败，请重试');
    }
    btn.disabled = false;
    btn.textContent = '下载';
  });

  // ===== 导入伴奏：上传 / 列表 / 播放 =====
  function getImportAudio() {
    if (!importAudio) {
      importAudio = new Audio();
      importAudio.loop = true;
      importAudio.addEventListener('ended', () => setPlayButton(false));
      importAudio.addEventListener('pause', () => setPlayButton(false));
      importAudio.addEventListener('play', () => setPlayButton(true));
    }
    return importAudio;
  }

  function playImported(t) {
    SynthEngine.stop();               // 停止合成引擎，避免叠音
    const a = getImportAudio();
    if (importAudioUrl) URL.revokeObjectURL(importAudioUrl);
    importAudioUrl = URL.createObjectURL(t.blob);
    a.src = importAudioUrl;
    a.loop = true;
    a.play().then(() => {
      showPlayer('🎵', t.name, `${t.goal} · 我的伴奏（循环播放）`, 'import', { file: t.blob, goal: t.goal });
      setPlayButton(true);   // play 事件先于 promise 触发，这里再确保一次按钮状态
      toast('正在播放伴奏 ✨');
    }).catch(() => toast('播放失败，请检查文件格式'));
  }

  document.getElementById('importGoalChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    importGoal = chip.dataset.goal;
    setActiveChip('#importGoalChips .chip', 'data-goal', chip.dataset.goal);
  });

  // 伴奏库搜索 / 筛选
  document.getElementById('libSearch').addEventListener('input', (e) => {
    libQuery = e.target.value;
    renderLibrary();
  });
  document.getElementById('libFilterChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    libFilter = chip.dataset.goal;
    setActiveChip('#libFilterChips .chip', 'data-goal', chip.dataset.goal);
    renderLibrary();
  });

  document.getElementById('btnImportMusic').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const f of files) {
      const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const base = f.name.replace(/\.[^.]+$/, '');
      await MusicStore.put({ id, name: base, fileName: f.name, goal: importGoal, blob: f, addedAt: Date.now() });
    }
    e.target.value = '';
    toast(`已导入 ${files.length} 首伴奏到「${importGoal}」主题`);
    renderLibrary();
  });

  async function renderImportList() {
    const list = document.getElementById('importList');
    list.innerHTML = '';
    let tracks = [];
    try { tracks = await MusicStore.getAll(); } catch (e) { tracks = []; }
    if (!tracks.length) {
      list.innerHTML = '<div class="empty-hint">还没有导入的伴奏，点上方「上传音乐文件」即可导入 mp3</div>';
      return;
    }
    tracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    tracks.forEach(t => {
      const div = document.createElement('div');
      div.className = 'music-item';
      div.innerHTML = `
        <div class="music-item-icon">🎵</div>
        <div class="music-item-info">
          <div class="music-item-title">${escapeHtml(t.name)}</div>
          <div class="music-item-sub">${escapeHtml(t.goal)} · 我的伴奏</div>
        </div>
        <button class="btn btn-ghost btn-sm del-import" data-id="${t.id}">删除</button>`;
      div.addEventListener('click', (e) => {
        if (e.target.closest('.del-import')) return;
        playImported(t);
      });
      div.querySelector('.del-import').addEventListener('click', async () => {
        await MusicStore.remove(t.id);
        renderLibrary();
        toast('已删除');
      });
      list.appendChild(div);
    });
  }

  // 根据 URL hash 打开对应页面
  const hash = (location.hash || '').replace('#', '');
  if (pages[hash]) navigate(hash);

  // ===== 命理（八字四柱，本地计算）=====
  let fateGender = '';
  document.querySelectorAll('#fateGenderChips .chip').forEach(c => {
    c.addEventListener('click', () => {
      fateGender = c.dataset.gender;
      document.querySelectorAll('#fateGenderChips .chip').forEach(x => x.classList.toggle('active', x === c));
    });
  });
  document.getElementById('fateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('fateDate').value;
    if (!dateVal) { toast('请先选择出生日期'); return; }
    const parts = dateVal.split('-').map(Number);
    const y = parts[0], m = parts[1], d = parts[2];
    const hourSel = document.getElementById('fateHour').value;
    const hour = hourSel === '' ? null : Number(hourSel);
    let res;
    try {
      res = computeBaZi(y, m, d, hour, fateGender);
    } catch (err) {
      toast('排盘出错，请检查日期');
      return;
    }
    renderFate(res);
    toast('已为你排盘 ✨');
  });
  function renderFate(res) {
    const result = document.getElementById('fateResult');
    if (!result) return;
    result.style.display = 'block';
    const pillars = [
      { label: '年', p: res.year },
      { label: '月', p: res.month },
      { label: '日', p: res.day },
      { label: '时', p: res.hour }
    ];
    document.getElementById('fatePillars').innerHTML = pillars.map(col => {
      const top = col.p ? GAN[col.p.gan] : '？';
      const bot = col.p ? ZHI[col.p.zhi] : '？';
      return `<div class="fate-pillar"><div class="fate-col-label">${col.label}</div>`
        + `<div class="fate-gz"><span class="fate-gan">${escapeHtml(top)}</span><span class="fate-zhi">${escapeHtml(bot)}</span></div></div>`;
    }).join('');
    document.getElementById('fateDayMaster').textContent = `${GAN[res.dayMaster]}（五行属${WU[res.dayMasterElement]}）`;
    document.getElementById('fateStrength').textContent = res.strength;
    const max = Math.max(1, ...res.elements);
    document.getElementById('fateWuBars').innerHTML = WU.map((name, i) => {
      const cnt = res.elements[i];
      const pct = Math.round((cnt / max) * 100);
      return `<div class="wu-bar-row"><span class="wu-name">${name}</span>`
        + `<span class="wu-track"><span class="wu-fill" style="width:${pct}%;background:${WU_COLOR[i]}"></span></span>`
        + `<span class="wu-cnt">${cnt}</span></div>`;
    }).join('');
    const note = getFateNote(res, new Date());
    document.getElementById('fateNote').innerHTML =
      `<p class="fate-line">${escapeHtml(note.line)}</p>`
      + `<p class="fate-strength">${escapeHtml(note.strengthText)}</p>`
      + `<p class="fate-yong">${escapeHtml(note.yongText)}</p>`;
  }

  // ===== 初始化 =====
  computeAffirmation();
  renderHome();
  renderWishes();
  ensurePresets().then(renderLibrary).catch(() => renderLibrary());
})();
