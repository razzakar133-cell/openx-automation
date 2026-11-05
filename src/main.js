import { Browser } from '@capacitor/browser';

const app = document.querySelector('#app');
const TASKS_KEY = 'openx_tasks_v1';
const DASH_KEY = 'openx_dash_v1';

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', color: '#1877F2', mark: 'f' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', mark: '▶' },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', mark: '◎' },
  { id: 'threads', name: 'Threads', color: '#8a8f98', mark: '@' },
];
const MODES = [
  { id: 'api', name: 'API', desc: 'Official • Stable' },
  { id: 'extension', name: 'Extension', desc: 'Chrome • Fast' },
  { id: 'desktop', name: 'Desktop', desc: 'Playwright • Stealth' },
];

let tasks = loadTasks();
let dash = loadDash();
let captions = [];
let lastTopic = '';
let recognition = null;
let listening = false;
let lastVoice = '';
let sidebarOpen = false;
let chatKey = localStorage.getItem('openx_gemini_key') || '';
let chatHist = loadChat();
let chatBusy = false;

function loadChat() {
  try {
    const value = JSON.parse(localStorage.getItem('openx_chat_v1') || '[]');
    return Array.isArray(value) ? value.slice(-30) : [];
  } catch { return []; }
}
function saveChat() { localStorage.setItem('openx_chat_v1', JSON.stringify(chatHist.slice(-30))); }

function loadTasks() {
  try {
    const value = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveTasks() { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }

function loadDash() {
  const fresh = { mode: 'api', platforms: {}, queue: [], log: [], published: 0, attempted: 0, connecting: null, visited: 0, tasksRun: 0, downloads: 0, bookmarks: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(DASH_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return fresh;
    return { ...fresh, ...saved, platforms: { ...(saved.platforms || {}) } };
  } catch { return fresh; }
}
function saveDash() {
  const { connecting, ...toSave } = dash;
  localStorage.setItem(DASH_KEY, JSON.stringify(toSave));
}
function platformState(id) {
  return dash.platforms[id] || { connected: false, token: '' };
}
function addLog(text) {
  dash.log.unshift({ ts: new Date().toISOString(), text });
  if (dash.log.length > 50) dash.log.length = 50;
  saveDash();
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function maskToken(token) {
  if (!token) return '';
  return token.length <= 4 ? '••••' : '••••' + token.slice(-4);
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function render() {
  const connectedCount = PLATFORMS.filter(p => platformState(p.id).connected).length;
  const totalPosts = dash.published + dash.queue.length;
  const success = dash.attempted === 0 ? '—' : Math.round((dash.published / dash.attempted) * 100) + '%';

  app.innerHTML = `
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#eef2f7;color:#1a2433;font-family:system-ui,Arial,sans-serif}
      .wrap{padding:16px;max-width:720px;margin:auto}
      h1{color:#1d4ed8;margin-bottom:2px;font-size:24px}
      h3{margin:0 0 8px}
      .muted{color:#5b6b7f;font-size:13px;line-height:1.5}
      .card{background:#ffffff;padding:16px;margin:14px 0;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.08)}
      input,select,textarea{width:100%;padding:12px;margin:7px 0;border:1px solid #cbd5e1;border-radius:9px;background:#ffffff;color:#1a2433;font-size:15px}
      textarea{min-height:70px;resize:vertical}
      button{border:0;border-radius:9px;padding:11px 14px;margin:5px 4px 5px 0;background:#2563eb;color:white;font-weight:700;font-size:14px}
      button.secondary{background:#e2e8f0;color:#1a2433}
      button.danger{background:#dc2626;color:white}
      button.ghost{background:#f1f5f9;color:#334155}
      button:disabled{opacity:.45}
      .row{display:flex;gap:8px;flex-wrap:wrap}
      .row button{flex:1}
      .pill{display:inline-block;background:#e2e8f0;padding:4px 9px;border-radius:20px;font-size:11px}
      .pill.on{background:#dcfce7;color:#15803d}
      .pill.warn{background:#fef3c7;color:#b45309}
      .stats{display:flex;gap:10px;flex-wrap:wrap}
      .stat{flex:1;min-width:100px;background:#dbeafe;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center}
      .stat:nth-child(2){background:#dcfce7}
      .stat:nth-child(3){background:#ede9fe}
      .stat b{font-size:22px;display:block;color:#1d4ed8}
      .stat:nth-child(2) b{color:#15803d}
      .stat:nth-child(3) b{color:#7c3aed}
      .stat span{font-size:12px;color:#475569}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .plat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px}
      .plat .dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-1px}
      .plat b{font-size:15px}
      .modebtn.on{background:#2563eb;color:white}
      .modebtn small{display:block;font-weight:400;font-size:11px;opacity:.75}
      .task,.qitem,.logitem{border:1px solid #e2e8f0;padding:12px;border-radius:10px;margin-top:10px;overflow-wrap:anywhere}
      .status{font-size:12px;color:#475569}
      .notice{border-left:3px solid #f59e0b;padding:8px 10px;background:#fef3c7;border-radius:5px}
      .cap{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-top:8px;white-space:pre-wrap}
      .logitem{font-size:13px;color:#475569}
      .logitem time{color:#94a3b8;font-size:11px}
      .topbar{display:flex;align-items:center;gap:10px;position:sticky;top:0;background:#eef2f7;padding:10px 0;z-index:20}
      .layout{display:grid;grid-template-columns:1fr;gap:0}
      @media (min-width:760px){.layout{grid-template-columns:340px 1fr;gap:14px;align-items:start}.col-chat{position:sticky;top:70px}}
      .drawer{position:fixed;top:0;left:0;bottom:0;width:260px;background:#ffffff;z-index:50;padding:16px;transform:translateX(-105%);transition:transform .25s;overflow:auto;box-shadow:0 0 20px rgba(15,23,42,.2)}
      .drawer.open{transform:translateX(0)}
      .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:40}
      .navitem{display:block;width:100%;text-align:left;background:none;color:#1a2433;padding:12px;border-radius:9px;margin:2px 0;font-size:15px}
      .navitem:hover{background:#f1f5f9}
      .aihead{display:flex;align-items:center;gap:10px}
      .avatar{font-size:26px;background:#dbeafe;border-radius:50%;width:46px;height:46px;display:flex;align-items:center;justify-content:center}
      .chips{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .chip{background:#f1f5f9;border:1px solid #e2e8f0;color:#1a2433;padding:12px;border-radius:12px;font-size:14px;text-align:left}
      .chatrow{display:flex;gap:8px;align-items:center}
      .chatrow input{flex:1}
      .tools{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
      .tool{background:#f8fafc;border:1px solid #e2e8f0;color:#1a2433;padding:12px 4px;border-radius:12px;font-size:12px}
    </style>
    <div class="wrap">
      <header class="topbar">
        <button id="menuBtn" class="ghost">☰</button>
        <div><h1 style="margin:0">🚀 OpenX</h1><div class="muted">অটো পোস্টিং ড্যাশবোর্ড v2.5 • সবকিছু এক জায়গায়</div></div>
      </header>
      <div class="drawer ${sidebarOpen ? 'open' : ''}" id="drawer">
        <h3 style="margin-top:0">☰ মেনু</h3>
        <button class="navitem" data-nav="live">🔴 লাইভ</button>
        <button class="navitem" data-nav="ai">🤖 AI সহকারী</button>
        <button class="navitem" data-nav="voice">🎙️ ভয়েস কন্ট্রোল</button>
        <button class="navitem" data-nav="platforms">🔗 প্ল্যাটফর্ম</button>
        <button class="navitem" data-nav="caption">✨ AI ক্যাপশন</button>
        <button class="navitem" data-nav="planner">🗓️ পোস্ট প্ল্যানার</button>
        <button class="navitem" data-nav="queue">📤 পাবলিশ কিউ</button>
        <button class="navitem" data-nav="browser">🌐 Browser</button>
        <button class="navitem" data-nav="tasks">🤖 টাস্ক প্ল্যানার</button>
        <button class="navitem" data-nav="log">🧾 অ্যাক্টিভিটি লগ</button>
        <button class="navitem" data-nav="settings">⚙️ সেটিংস</button>
        <button class="navitem" data-close-sidebar>✕ বন্ধ করো</button>
      </div>
      ${sidebarOpen ? '<div class="backdrop" data-close-sidebar></div>' : ''}
      <div class="layout">
      <div class="col-chat">
      <section class="card" id="sec-ai">
        <div class="aihead">
          <span class="avatar">🤖</span>
          <div><b>AI Assistant</b><br><span class="pill on">● Online</span></div>
          <button class="ghost" data-nav="settings" style="margin-left:auto">⚙️</button>
          <span class="avatar">👤</span>
        </div>

        <div class="cap" style="margin-top:12px">👋 আপনি কী করতে চান?</div>
        <div class="chips">
          <button class="chip" data-chip="surf">⚡ ওয়েব সার্ফ</button>
          <button class="chip" data-chip="content">📄 কনটেন্ট লিখুন</button>
          <button class="chip" data-chip="search">🛒 অনুসন্ধান করুন</button>
          <button class="chip" data-chip="ideas">💡 আইডিয়া দিন</button>
          <button class="chip" data-chip="code">&lt;/&gt; কোড লিখুন</button>
          <button class="chip" data-chip="more">••• আরও দেখুন</button>
        </div>
        <div id="chatBox">${chatHist.length ? chatHist.map(m => `
          <div class="cap" style="${m.role === 'user' ? 'border-color:#2563eb;text-align:right' : ''}"><b>${m.role === 'user' ? 'তুমি' : 'AI'}:</b> ${escapeHTML(m.text)}</div>`).join('') : '<p class="muted">হাই! আমি তোমার AI সহকারী — কী করতে চাও বলো। 😊</p>'}
          ${chatBusy ? '<p class="muted">লিখছি…</p>' : ''}
        </div>
        <div class="chatrow">
          <input id="chatInput" placeholder="আপনার প্রশ্ন লিখুন...">
          <button id="chatMicBtn" class="ghost">🎙️</button>
          <button id="sendChat">➤</button>
        </div>
        <button id="clearChat" class="secondary">চ্যাট মুছুন</button>
        <div class="stats" style="margin-top:12px">
          <div class="stat"><b>${dash.visited || 0}</b><span>🌐 Visited Sites</span></div>
          <div class="stat"><b>${dash.tasksRun || 0}</b><span>✅ Tasks Run</span></div>
          <div class="stat"><b>${dash.downloads || 0}</b><span>⬇️ Downloads</span></div>
        </div>
        <h3 style="margin-top:14px">⚡ Quick Tools <button class="ghost" data-nav="settings" style="float:right">View All →</button></h3>
        <div class="tools">
          <button class="tool" data-tool="autoclick">🖱️<br>Auto Click</button>
          <button class="tool" data-tool="autofill">📝<br>Auto Fill</button>
          <button class="tool" data-tool="scheduler">📅<br>Scheduler</button>
          <button class="tool" data-tool="bookmarks">⭐<br>Bookmarks</button>
        </div>
        ${chatKey ? `<p class="muted">API Key সংরক্ষিত ✓ <button class="ghost" data-change-key>Key বদলাও</button></p>` : `
        <p class="muted notice">AI-এর সাথে কথা বলতে ফ্রি Gemini API Key দাও — একদম ফ্রি, টাকা লাগে না।</p>
        <button id="openAistudio" class="secondary">ফ্রি Key নাও (aistudio.google.com)</button>
        <input id="geminiKey" type="password" placeholder="Gemini API Key এখানে লিখো">
        <button id="saveKey">Key সংরক্ষণ করো</button>`}
      </section>
      <section class="card" id="sec-voice">
        <h3>🎙️ ভয়েস কন্ট্রোল</h3>
        <p class="muted">মাইক চালু করে বলো — যেমন "Facebook খোলো", "ক্যাপশন বানাও", "কিউ দেখাও"।</p>
        <button id="micBtn">${listening ? '⏹️ ভয়েস বন্ধ করো' : '🎙️ ভয়েস চালু করো'}</button>
        <p id="voiceStatus" class="muted">${listening ? 'শুনছি… 🎧' : 'ভয়েস বন্ধ আছে'}</p>
        ${lastVoice ? `<p class="muted">শেষ কমান্ড: ${escapeHTML(lastVoice)}</p>` : ''}
        <p class="muted">চলবে: Facebook / YouTube / Instagram / Threads খোলো • ক্যাপশন বানাও • কিউ দেখাও • লগ দেখাও • উপরে যাও<br>নোট: Chrome ব্রাউজারে ভালো চলে; APK-তে ফোনের WebView অনুযায়ী নাও চলতে পারে।</p>
      </section>
      </div>
      <div class="col-live">
      <section class="card" id="sec-live">
        <h3>🔴 লাইভ — এখন কী হচ্ছে</h3>
        <div class="stats">
          <div class="stat"><b>${totalPosts}</b><span>মোট পোস্ট</span></div>
          <div class="stat"><b>${success}</b><span>সফলতা</span></div>
          <div class="stat"><b>${connectedCount}/4</b><span>সংযুক্ত</span></div>
        </div>
        <p class="muted">সর্বশেষ: ${dash.log[0] ? escapeHTML(dash.log[0].text) + ' • ' + fmtTime(dash.log[0].ts) : 'এখনো কিছু হয়নি'}</p>
        <p class="muted">কিউ: ${dash.queue.filter(q => q.status !== 'Published').length}টি অপেক্ষমাণ • পাবলিশ: ${dash.published}</p>
      </section>

      <div class="row" style="margin-top:12px">
        ${MODES.map(m => `<button class="modebtn secondary ${dash.mode === m.id ? 'on' : ''}" data-mode="${m.id}">${m.name}<small>${m.desc}</small></button>`).join('')}
      </div>

      <section class="card" id="sec-platforms">
        <h3>🔗 প্ল্যাটফর্ম</h3>
        <div class="grid">
          ${PLATFORMS.map(p => {
            const st = platformState(p.id);
            const connecting = dash.connecting === p.id;
            return `<div class="plat">
              <span class="dot" style="background:${p.color}"></span><b>${p.name}</b>
              <span class="pill ${st.connected ? 'on' : 'warn'}" style="float:right">${st.connected ? 'সংযুক্ত' : 'সংযুক্ত নয়'}</span>
              <p class="muted" style="margin:8px 0">${st.connected ? 'টোকেন: ' + maskToken(st.token) : 'API টোকেন দিয়ে কানেক্ট করো'}</p>
              ${connecting ? `
                <input id="token-${p.id}" type="password" placeholder="API টোকেন লিখো">
                <button data-save-token="${p.id}">সংরক্ষণ করো</button>
                <button class="secondary" data-cancel-token>বাতিল</button>` : st.connected ? `
                <button class="danger" data-disconnect="${p.id}">ডিসকানেক্ট</button>` : `
                <button data-connect="${p.id}">Connect</button>`}
            </div>`;
          }).join('')}
        </div>
        <p class="muted notice">টোকেন শুধু এই ডিভাইসেই থাকে, কোথাও পাঠানো হয় না। আসল পোস্টের জন্য প্ল্যাটফর্মের অফিসিয়াল API অনুমোদন লাগবে।</p>
      </section>



      <section class="card" id="sec-caption">
        <h3>✨ AI ক্যাপশন</h3>
        <input id="capTopic" value="${escapeHTML(lastTopic)}" placeholder="বিষয় লিখো — যেমন: funny cat video">
        <div class="row">
          <button id="genCaption">ক্যাপশন বানাও</button>
          <button id="genTags" class="secondary"># হ্যাশট্যাগ বানাও</button>
        </div>
        <div id="capOut">${captions.map((c, i) => `
          <div class="cap">${escapeHTML(c)}</div>
          <button class="ghost" data-copy-cap="${i}">কপি করো</button>`).join('')}
        </div>
      </section>

      <section class="card" id="sec-planner">
        <h3>🗓️ পোস্ট প্ল্যানার</h3>
        <input id="postTitle" maxlength="240" placeholder="পোস্টের টাইটেল">
        <textarea id="postDesc" placeholder="বিবরণ / ক্যাপশন (ঐচ্ছিক)"></textarea>
        <select id="postPlatform">
          ${PLATFORMS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <input id="postWhen" type="datetime-local">
        <button id="addPost">কিউতে যোগ করো</button>
      </section>

      <section class="card" id="sec-queue">
        <h3>📤 পাবলিশ কিউ</h3>
        <p class="muted notice">এই সংস্করণে "পাবলিশ" মানে লোকাল রেকর্ড — আসল পোস্ট প্ল্যাটফর্মের অফিসিয়াল API দিয়ে হবে।</p>
        <div id="queueList">${dash.queue.length ? dash.queue.map(q => `
          <article class="qitem">
            <b>${escapeHTML(q.title)}</b>
            <p class="status">
              <span class="pill">${escapeHTML(PLATFORMS.find(p => p.id === q.platform)?.name || q.platform)}</span>
              <span class="pill ${q.status === 'Published' ? 'on' : 'warn'}">${escapeHTML(q.status)}</span>
              <br>সময়: ${escapeHTML(fmtTime(q.when))}
              ${q.desc ? `<br>${escapeHTML(q.desc)}` : ''}
            </p>
            ${q.status !== 'Published' ? `<button data-publish="${q.id}">এখনই পাবলিশ</button>` : ''}
            <button class="danger" data-del-post="${q.id}">মুছুন</button>
          </article>`).join('') : '<p class="muted">কিউ খালি — প্ল্যানার থেকে পোস্ট যোগ করো।</p>'}
        </div>
      </section>

      <section class="card" id="sec-browser">
        <h3>🌐 Browser</h3>
        <input id="url" placeholder="example.com অথবা https://example.com" autocomplete="url">
        <button id="open">ওয়েবসাইট খোলো</button>
        <input id="search" placeholder="Google-এ কী সার্চ করবে?">
        <button id="searchBtn" class="secondary">Google Search</button>
        <div id="bmList">${(dash.bookmarks || []).map(b => `
          <div class="logitem">${escapeHTML(b.title)} <button class="ghost" data-open-bm="${b.id}">খোলো</button> <button class="danger" data-del-bm="${b.id}">✕</button></div>`).join('')}
        </div>
        <button id="addBookmark" class="secondary">🔖 এই ঠিকানা বুকমার্ক করো</button>
      </section>

      <section class="card" id="sec-tasks">
        <h3>🤖 Agent Task Planner</h3>
        <p class="muted">কাজের নির্দেশ লিখলে সেটি Approval Queue-তে যাবে।</p>
        <input id="taskTitle" maxlength="240" placeholder="যেমন: একটি Facebook পোস্টের খসড়া তৈরি করো">
        <select id="taskType">
          <option value="Content draft">Content / Draft</option>
          <option value="Browser task">Browser task</option>
          <option value="Social media">Social Media</option>
          <option value="Email">Email</option>
          <option value="Other">অন্যান্য</option>
        </select>
        <button id="addTask">কাজ যোগ করো</button>
      </section>

      <section class="card" id="sec-tasks">
        <h3>🛡️ Approval Queue</h3>
        <p class="muted notice">Approve করলে শুধু অনুমোদনের রেকর্ড হবে। এই সংস্করণ নিজে থেকে পোস্ট, মেসেজ, ইমেইল বা কেনাকাটা করবে না।</p>
        <div id="taskList">${tasks.length ? tasks.map(task => `
          <article class="task">
            <b>${escapeHTML(task.title)}</b>
            <p class="status">
              <span class="pill">${escapeHTML(task.type)}</span>
              <br>অবস্থা: ${escapeHTML(task.status)}
              <br>সময়: ${escapeHTML(fmtTime(task.createdAt))}
            </p>
            ${task.status === 'Pending approval' ? `
              <button data-approve="${task.id}">Approve</button>
              <button class="danger" data-reject="${task.id}">Reject</button>
            ` : ''}
          </article>`).join('') : '<p class="muted">এখনো কোনো কাজ যোগ করা হয়নি।</p>'}
        </div>
      </section>

      <section class="card" id="sec-tasks">
        <h3>📊 Activity History</h3>
        <p id="historyCount" class="muted">মোট কাজ: ${tasks.length} • পাবলিশ: ${dash.published}</p>
        <button id="clearHistory" class="danger">সব ইতিহাস মুছুন</button>
      </section>

      <section class="card" id="sec-log">
        <h3>🧾 অ্যাক্টিভিটি লগ</h3>
        <div id="logList">${dash.log.length ? dash.log.map(e => `
          <div class="logitem"><time>${escapeHTML(fmtTime(e.ts))}</time> — ${escapeHTML(e.text)}</div>`).join('') : '<p class="muted">এখনো কোনো অ্যাক্টিভিটি নেই।</p>'}
        </div>
        <button id="clearLog" class="secondary">লগ মুছুন</button>
      </section>

      <section class="card" id="sec-settings">
        <h3>⚙️ সেটিংস</h3>
        <button id="exportData" class="secondary">ডেটা এক্সপোর্ট (JSON)</button>
        <button id="clearAll" class="danger">সব ডেটা মুছুন</button>
        <p class="muted">OpenX Automation v2.5 • Prototype • কোনো পাসওয়ার্ড বা API key এখানে লিখবে না — টোকেন শুধু এই ডিভাইসে থাকে।</p>
      </section>
      </div>
      </div>
    </div>
  `;
}

function makeCaptions(topic) {
  const t = topic.trim();
  return [
    `🔥 ${t} — মিস করলে পস্তাবে!\nদেখো, লাইক করো, শেয়ার করো ❤️`,
    `${t} 🎬\nআজকের সেরা ভিডিও — কমেন্টে জানাও কেমন লাগলো 👇`,
    `✨ ${t}\nভালো লাগলে ফলো করো — নতুন ভিডিও আসছে প্রতিদিন!`,
  ];
}
function makeHashtags(topic) {
  const words = topic.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF ]/gi, '').split(/\s+/).filter(Boolean).slice(0, 5);
  const tags = words.map(w => '#' + w);
  return [...tags, '#viral', '#reels', '#bangladesh', '#trending'].join(' ');
}

function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'bn-BD';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* voice feedback optional */ }
}

async function handleVoiceCommand(raw) {
  const cmd = raw.toLowerCase();
  lastVoice = raw;
  let action = '';
  const openSite = async (url, name) => {
    await Browser.open({ url });
    bumpVisit();
    action = `${name} খুলছি`;
  };
  if (cmd.includes('facebook') || cmd.includes('ফেসবুক')) await openSite('https://www.facebook.com', 'Facebook');
  else if (cmd.includes('youtube') || cmd.includes('ইউটিউব')) await openSite('https://www.youtube.com', 'YouTube');
  else if (cmd.includes('instagram') || cmd.includes('ইনস্টাগ্রাম')) await openSite('https://www.instagram.com', 'Instagram');
  else if (cmd.includes('threads') || cmd.includes('থ্রেড')) await openSite('https://www.threads.net', 'Threads');
  else if (cmd.includes('গুগল') || cmd.includes('google')) await openSite('https://www.google.com', 'Google');
  else if (cmd.includes('ক্যাপশন')) {
    const topic = document.querySelector('#capTopic')?.value.trim();
    if (!topic) action = 'প্রথমে ক্যাপশনের বিষয় লিখো';
    else {
      lastTopic = topic;
      captions = makeCaptions(topic);
      addLog(`AI ক্যাপশন বানানো হয়েছে: ${topic}`);
      action = 'ক্যাপশন বানানো হয়েছে';
    }
  } else if (cmd.includes('হ্যাশট্যাগ') || cmd.includes('hashtag')) {
    const topic = document.querySelector('#capTopic')?.value.trim();
    if (!topic) action = 'প্রথমে বিষয় লিখো';
    else {
      lastTopic = topic;
      captions = [makeHashtags(topic)];
      addLog(`হ্যাশট্যাগ বানানো হয়েছে: ${topic}`);
      action = 'হ্যাশট্যাগ বানানো হয়েছে';
    }
  } else if (cmd.includes('কিউ') || cmd.includes('queue')) {
    document.querySelector('#queueList')?.scrollIntoView();
    action = `কিউতে ${dash.queue.length}টি পোস্ট আছে`;
  } else if (cmd.includes('লগ')) {
    document.querySelector('#logList')?.scrollIntoView();
    action = 'অ্যাক্টিভিটি লগ দেখাচ্ছি';
  } else if (cmd.includes('উপরে') || cmd.includes('হোম') || cmd.includes('home')) {
    window.scrollTo(0, 0);
    action = 'উপরে চলে এসেছি';
  } else {
    action = 'বুঝতে পারিনি, আবার বলো';
  }
  addLog(`🎙️ ভয়েস: "${raw}" → ${action}`);
  speak(action);
  render();
}

const AI_SYSTEM = 'তুমি OpenX অ্যাপের ভেতরের AI সহকারী। ব্যবহারকারী বাংলায় কথা বলে, তুমি বাংলায় উত্তর দাও। তুমি সাহায্য করো: ক্যাপশন বানানো, হ্যাশট্যাগ, পোস্ট প্ল্যান, অ্যাপ চালানো। অ্যাকশন লাগলে উত্তরের শেষে এই মার্কারগুলো ব্যবহার করো (এক লাইনে একটা): [OPEN:facebook] [OPEN:youtube] [OPEN:instagram] [OPEN:threads] [OPEN:google] [CAPTION:বিষয়] [ADDPOST:টাইটেল|facebook] — মার্কারগুলো উত্তরে দেখাবে না, অ্যাপ নিজে কাজ করবে। মার্কার ছাড়া সাধারণ উত্তর দাও।';

async function runAiActions(text) {
  let didAction = false;
  const opens = [...text.matchAll(/\[OPEN:(facebook|youtube|instagram|threads|google)\]/gi)];
  for (const m of opens) {
    const sites = { facebook: 'https://www.facebook.com', youtube: 'https://www.youtube.com', instagram: 'https://www.instagram.com', threads: 'https://www.threads.net', google: 'https://www.google.com' };
    try { await Browser.open({ url: sites[m[1].toLowerCase()] }); bumpVisit(); didAction = true; } catch { /* ignore */ }
  }
  const cap = text.match(/\[CAPTION:([^\]]+)\]/i);
  if (cap) {
    lastTopic = cap[1].trim();
    captions = makeCaptions(lastTopic);
    addLog(`AI ক্যাপশন বানানো হয়েছে: ${lastTopic}`);
    didAction = true;
  }
  const post = text.match(/\[ADDPOST:([^|\]]+)\|?(facebook|youtube|instagram|threads)?\]/i);
  if (post) {
    const platform = (post[2] || 'facebook').toLowerCase();
    dash.queue.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: post[1].trim(), desc: '', platform, when: new Date().toISOString(), status: 'Scheduled' });
    saveDash();
    addLog(`AI কিউতে যোগ করেছে: ${post[1].trim()} → ${platform}`);
    didAction = true;
  }
  if (didAction) bumpTasksRun();
}

async function sendChatMessage() {
  const input = document.querySelector('#chatInput');
  const text = (input?.value || '').trim();
  if (!text || chatBusy) return;
  if (!chatKey) return alert('প্রথমে Gemini API Key সংরক্ষণ করো।');
  chatHist.push({ role: 'user', text });
  saveChat();
  chatBusy = true;
  render();
  try {
    const contents = [{ role: 'user', parts: [{ text: AI_SYSTEM + '\n\nব্যবহারকারী: ' + text }] }];
    for (const m of chatHist.slice(-8)) {
      if (m.role === 'user' && m.text !== text) contents.push({ role: 'user', parts: [{ text: m.text }] });
      if (m.role === 'ai') contents.push({ role: 'model', parts: [{ text: m.text }] });
    }
    contents.push({ role: 'user', parts: [{ text }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(chatKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    let reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!reply.trim()) throw new Error('empty reply');
    await runAiActions(reply);
    reply = reply.replace(/\[(OPEN|CAPTION|ADDPOST):[^\]]+\]/gi, '').trim();
    chatHist.push({ role: 'ai', text: reply });
    saveChat();
    addLog('🤖 AI উত্তর দিয়েছে');
  } catch {
    chatHist.push({ role: 'ai', text: 'দুঃখিত, AI-এর সাথে যোগাযোগ হয়নি — Key আর ইন্টারনেট চেক করো।' });
    saveChat();
  }
  chatBusy = false;
  render();
}

function scrollToSec(id) {
  const el = document.getElementById(id);
  if (el && el.scrollIntoView) el.scrollIntoView();
}
function aiAsk(text) {
  if (!chatKey) return alert('প্রথমে Gemini API Key সংরক্ষণ করো।');
  const input = document.querySelector('#chatInput');
  if (input) { input.value = text; sendChatMessage(); }
}
function bumpVisit() { dash.visited = (dash.visited || 0) + 1; saveDash(); }
function bumpTasksRun() { dash.tasksRun = (dash.tasksRun || 0) + 1; saveDash(); }

app.addEventListener('click', async event => {
  const target = event.target;

  if (target.id === 'menuBtn') {
    sidebarOpen = !sidebarOpen;
    render();
    return;
  }
  if (target.hasAttribute('data-close-sidebar')) {
    sidebarOpen = false;
    render();
    return;
  }
  if (target.dataset.nav) {
    sidebarOpen = false;
    render();
    const el = document.getElementById('sec-' + target.dataset.nav);
    if (el && el.scrollIntoView) el.scrollIntoView();
    return;
  }

  if (target.id === 'openAistudio') {
    await Browser.open({ url: 'https://aistudio.google.com/app/apikey' });
    bumpVisit();
    return;
  }
  if (target.id === 'saveKey') {
    const key = (document.querySelector('#geminiKey')?.value || '').trim();
    if (!key) return alert('API Key লিখো।');
    chatKey = key;
    localStorage.setItem('openx_gemini_key', key);
    addLog('🤖 AI Key সংরক্ষণ করা হয়েছে');
    render();
    return;
  }
  if (target.hasAttribute('data-change-key')) {
    chatKey = '';
    localStorage.removeItem('openx_gemini_key');
    render();
    return;
  }
  if (target.id === 'sendChat') {
    sendChatMessage();
    return;
  }
  if (target.id === 'clearChat' && confirm('চ্যাট ইতিহাস মুছবেন?')) {
    chatHist = [];
    saveChat();
    render();
    return;
  }

  if (target.dataset.chip) {
    const c = target.dataset.chip;
    if (c === 'surf') { scrollToSec('sec-browser'); document.querySelector('#url')?.focus(); }
    else if (c === 'content') { scrollToSec('sec-caption'); document.querySelector('#capTopic')?.focus(); }
    else if (c === 'search') { scrollToSec('sec-browser'); document.querySelector('#search')?.focus(); }
    else if (c === 'ideas') aiAsk('আমাকে ৫টি ভালো ভাইরাল পোস্টের আইডিয়া দাও');
    else if (c === 'code') aiAsk('একটা ছোট HTML/CSS কোডের উদাহরণ দাও');
    else if (c === 'more') { sidebarOpen = true; render(); }
    return;
  }
  if (target.dataset.tool) {
    const t = target.dataset.tool;
    if (t === 'autoclick') {
      const connected = PLATFORMS.filter(p => platformState(p.id).connected);
      if (!connected.length) return alert('আগে একটি প্ল্যাটফর্ম কানেক্ট করো।');
      for (const p of connected) {
        try { await Browser.open({ url: { facebook: 'https://www.facebook.com', youtube: 'https://www.youtube.com', instagram: 'https://www.instagram.com', threads: 'https://www.threads.net' }[p.id] }); bumpVisit(); } catch { /* ignore */ }
      }
      addLog(`🖱️ Auto Click: ${connected.length}টি প্ল্যাটফর্ম খোলা হয়েছে`);
      render();
    } else if (t === 'autofill') {
      if (!captions.length) return alert('আগে ক্যাপশন বানাও।');
      scrollToSec('sec-planner');
      const title = document.querySelector('#postTitle');
      const desc = document.querySelector('#postDesc');
      if (title) title.value = lastTopic || 'নতুন পোস্ট';
      if (desc) desc.value = captions[0];
      addLog('📝 Auto Fill: প্ল্যানার ভরা হয়েছে');
    } else if (t === 'scheduler') scrollToSec('sec-planner');
    else if (t === 'bookmarks') scrollToSec('sec-browser');
    return;
  }
  if (target.id === 'chatMicBtn') {
    document.querySelector('#micBtn')?.click();
    return;
  }
  if (target.id === 'addBookmark') {
    let url = document.querySelector('#url')?.value.trim();
    if (!url) return alert('প্রথমে ঠিকানা লিখো।');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    dash.bookmarks = dash.bookmarks || [];
    dash.bookmarks.unshift({ id: `${Date.now()}`, title: url, url });
    saveDash();
    addLog(`🔖 বুকমার্ক যোগ হয়েছে: ${url}`);
    render();
    return;
  }
  if (target.dataset.openBm) {
    const bm = (dash.bookmarks || []).find(b => b.id === target.dataset.openBm);
    if (bm) { await Browser.open({ url: bm.url }); bumpVisit(); }
    return;
  }
  if (target.dataset.delBm) {
    dash.bookmarks = (dash.bookmarks || []).filter(b => b.id !== target.dataset.delBm);
    saveDash();
    render();
    return;
  }

  if (target.id === 'micBtn') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('এই ব্রাউজারে ভয়েস চলে না — Chrome ব্রাউজারে চালাও।');
      return;
    }
    if (listening) {
      listening = false;
      try { recognition?.stop(); } catch { /* ignore */ }
      recognition = null;
      render();
      return;
    }
    try {
      recognition = new SR();
      recognition.lang = 'bn-BD';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = e => {
        const transcript = e.results?.[e.resultIndex || 0]?.[0]?.transcript || '';
        if (transcript.trim()) handleVoiceCommand(transcript.trim());
      };
      recognition.onerror = () => {
        listening = false;
        recognition = null;
        render();
      };
      recognition.onend = () => {
        if (listening) { try { recognition?.start(); } catch { /* ignore */ } }
      };
      recognition.start();
      listening = true;
      speak('ভয়েস চালু হয়েছে, বলো');
      render();
    } catch {
      alert('ভয়েস চালু করা যায়নি — মাইকের অনুমতি দাও, তারপর আবার চেষ্টা করো।');
    }
    return;
  }

  if (target.dataset.mode) {
    dash.mode = target.dataset.mode;
    saveDash();
    addLog(`মোড বদলানো হয়েছে: ${MODES.find(m => m.id === dash.mode)?.name}`);
    render();
    return;
  }

  if (target.dataset.connect) {
    dash.connecting = target.dataset.connect;
    render();
    return;
  }
  if (target.hasAttribute('data-cancel-token')) {
    dash.connecting = null;
    render();
    return;
  }
  if (target.dataset.saveToken) {
    const id = target.dataset.saveToken;
    const input = document.querySelector(`#token-${id}`);
    const token = (input?.value || '').trim();
    if (!token) return alert('টোকেন লিখো।');
    dash.platforms[id] = { connected: true, token };
    dash.connecting = null;
    saveDash();
    addLog(`${PLATFORMS.find(p => p.id === id)?.name} কানেক্ট হয়েছে`);
    render();
    return;
  }
  if (target.dataset.disconnect) {
    const id = target.dataset.disconnect;
    if (confirm(`${PLATFORMS.find(p => p.id === id)?.name} ডিসকানেক্ট করবেন?`)) {
      dash.platforms[id] = { connected: false, token: '' };
      saveDash();
      addLog(`${PLATFORMS.find(p => p.id === id)?.name} ডিসকানেক্ট হয়েছে`);
      render();
    }
    return;
  }

  if (target.id === 'genCaption') {
    const topic = document.querySelector('#capTopic').value.trim();
    if (!topic) return alert('বিষয় লিখো।');
    lastTopic = topic;
    captions = makeCaptions(topic);
    addLog(`AI ক্যাপশন বানানো হয়েছে: ${topic}`);
    render();
    return;
  }
  if (target.id === 'genTags') {
    const topic = document.querySelector('#capTopic').value.trim();
    if (!topic) return alert('বিষয় লিখো।');
    lastTopic = topic;
    captions = [makeHashtags(topic)];
    addLog(`হ্যাশট্যাগ বানানো হয়েছে: ${topic}`);
    render();
    return;
  }
  if (target.dataset.copyCap !== undefined && target.dataset.copyCap !== '') {
    const text = captions[Number(target.dataset.copyCap)] || '';
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error('no clipboard');
      target.textContent = 'কপি হয়েছে ✓';
    } catch { alert('কপি হয়নি — লেখাটা সিলেক্ট করে কপি করো।'); }
    return;
  }

  if (target.id === 'addPost') {
    const title = document.querySelector('#postTitle').value.trim();
    const desc = document.querySelector('#postDesc').value.trim();
    const platform = document.querySelector('#postPlatform').value;
    const when = document.querySelector('#postWhen').value;
    if (!title) return alert('পোস্টের টাইটেল লিখো।');
    dash.queue.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title, desc, platform,
      when: when ? new Date(when).toISOString() : new Date().toISOString(),
      status: 'Scheduled',
    });
    saveDash();
    addLog(`কিউতে যোগ হয়েছে: ${title} → ${PLATFORMS.find(p => p.id === platform)?.name}`);
    render();
    return;
  }
  if (target.dataset.publish) {
    const item = dash.queue.find(q => q.id === target.dataset.publish);
    if (!item) return;
    const pname = PLATFORMS.find(p => p.id === item.platform)?.name;
    if (!platformState(item.platform).connected) return alert(`আগে ${pname} কানেক্ট করো।`);
    if (!confirm(`"${item.title}" — ${pname}-এ পাবলিশ হিসেবে চিহ্নিত করবেন?`)) return;
    item.status = 'Published';
    dash.published += 1;
    dash.attempted += 1;
    bumpTasksRun();
    saveDash();
    addLog(`✅ পাবলিশ হয়েছে: ${item.title} → ${pname}`);
    render();
    return;
  }
  if (target.dataset.delPost) {
    if (!confirm('এই পোস্টটি কিউ থেকে মুছবেন?')) return;
    dash.queue = dash.queue.filter(q => q.id !== target.dataset.delPost);
    saveDash();
    render();
    return;
  }

  if (target.id === 'open') {
    let url = document.querySelector('#url').value.trim();
    if (!url) return alert('ওয়েবসাইটের ঠিকানা লিখুন।');
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
      await Browser.open({ url: parsed.href });
      bumpVisit();
    } catch {
      alert('ঠিকানাটি সঠিক নয় অথবা Browser খোলা যায়নি।');
    }
    return;
  }
  if (target.id === 'searchBtn') {
    const query = document.querySelector('#search').value.trim();
    if (!query) return alert('সার্চের বিষয় লিখুন।');
    await Browser.open({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
    bumpVisit();
    return;
  }

  if (target.id === 'addTask') {
    const title = document.querySelector('#taskTitle').value.trim();
    const type = document.querySelector('#taskType').value;
    if (!title) return alert('কাজের নির্দেশ লিখুন।');
    tasks.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title, type, status: 'Pending approval', createdAt: new Date().toISOString(),
    });
    saveTasks();
    render();
    return;
  }
  if (target.dataset.approve) {
    const task = tasks.find(item => item.id === target.dataset.approve);
    if (task && confirm('এই কাজটি অনুমোদন হিসেবে চিহ্নিত করবেন?')) {
      task.status = 'Approved — not executed';
      saveTasks();
      bumpTasksRun();
      render();
    }
    return;
  }
  if (target.dataset.reject) {
    const task = tasks.find(item => item.id === target.dataset.reject);
    if (task && confirm('এই কাজটি বাতিল করবেন?')) {
      task.status = 'Rejected';
      saveTasks();
      render();
    }
    return;
  }
  if (target.id === 'clearHistory' && confirm('সব কাজের ইতিহাস মুছে ফেলবেন?')) {
    tasks = [];
    saveTasks();
    render();
    return;
  }

  if (target.id === 'clearLog' && confirm('অ্যাক্টিভিটি লগ মুছবেন?')) {
    dash.log = [];
    saveDash();
    render();
    return;
  }
  if (target.id === 'exportData') {
    const data = { exportedAt: new Date().toISOString(), platforms: dash.platforms, queue: dash.queue, log: dash.log, published: dash.published, tasks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'openx-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
    dash.downloads = (dash.downloads || 0) + 1;
    saveDash();
    addLog('ডেটা এক্সপোর্ট করা হয়েছে (JSON)');
    return;
  }
  if (target.id === 'clearAll' && confirm('সব ডেটা (প্ল্যাটফর্ম, কিউ, লগ, কাজ) মুছে ফেলবেন?')) {
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(DASH_KEY);
    tasks = [];
    dash = loadDash();
    captions = [];
    render();
    return;
  }
});

render();

app.addEventListener('keydown', event => {
  if (event.target?.id === 'chatInput' && event.key === 'Enter') {
    event.preventDefault();
    sendChatMessage();
  }
});
