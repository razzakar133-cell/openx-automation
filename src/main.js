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

function loadTasks() {
  try {
    const value = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveTasks() { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }

function loadDash() {
  const fresh = { mode: 'api', platforms: {}, queue: [], log: [], published: 0, attempted: 0, connecting: null };
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
      body{margin:0;background:#0b0f1a;color:#f4f7fb;font-family:system-ui,Arial,sans-serif}
      .wrap{padding:16px;max-width:720px;margin:auto}
      h1{color:#54d6a0;margin-bottom:2px;font-size:24px}
      h3{margin:0 0 8px}
      .muted{color:#b8c5d6;font-size:13px;line-height:1.5}
      .card{background:#1b293d;padding:16px;margin:14px 0;border-radius:14px}
      input,select,textarea{width:100%;padding:12px;margin:7px 0;border:1px solid #506078;border-radius:9px;background:#101827;color:white;font-size:15px}
      textarea{min-height:70px;resize:vertical}
      button{border:0;border-radius:9px;padding:11px 14px;margin:5px 4px 5px 0;background:#54d6a0;color:#10221b;font-weight:700;font-size:14px}
      button.secondary{background:#354963;color:white}
      button.danger{background:#b94343;color:white}
      button.ghost{background:#263b55;color:#dbe7f5}
      button:disabled{opacity:.45}
      .row{display:flex;gap:8px;flex-wrap:wrap}
      .row button{flex:1}
      .pill{display:inline-block;background:#263b55;padding:4px 9px;border-radius:20px;font-size:11px}
      .pill.on{background:#14532d;color:#86efac}
      .pill.warn{background:#713f12;color:#fde68a}
      .stats{display:flex;gap:10px;flex-wrap:wrap}
      .stat{flex:1;min-width:100px;background:#1b293d;border:1px solid #2b3f58;border-radius:12px;padding:12px;text-align:center}
      .stat b{font-size:22px;display:block;color:#54d6a0}
      .stat span{font-size:12px;color:#b8c5d6}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .plat{background:#101827;border:1px solid #2b3f58;border-radius:12px;padding:12px}
      .plat .dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-1px}
      .plat b{font-size:15px}
      .modebtn.on{background:#54d6a0}
      .modebtn small{display:block;font-weight:400;font-size:11px;opacity:.75}
      .task,.qitem,.logitem{border:1px solid #40536d;padding:12px;border-radius:10px;margin-top:10px;overflow-wrap:anywhere}
      .status{font-size:12px;color:#c5d4e7}
      .notice{border-left:3px solid #e6b450;padding:8px 10px;background:#263247;border-radius:5px}
      .cap{background:#101827;border:1px solid #2b3f58;border-radius:10px;padding:10px;margin-top:8px;white-space:pre-wrap}
      .logitem{font-size:13px;color:#c5d4e7}
      .logitem time{color:#8fa3bb;font-size:11px}
    </style>
    <div class="wrap">
      <h1>🚀 অটো পোস্টিং ড্যাশবোর্ড</h1>
      <div class="muted">OpenX Automation v2.0 • সবকিছু এক জায়গায় নিয়ন্ত্রণ করো</div>

      <div class="row" style="margin-top:12px">
        ${MODES.map(m => `<button class="modebtn secondary ${dash.mode === m.id ? 'on' : ''}" data-mode="${m.id}">${m.name}<small>${m.desc}</small></button>`).join('')}
      </div>

      <div class="stats" style="margin-top:12px">
        <div class="stat"><b>${totalPosts}</b><span>মোট পোস্ট</span></div>
        <div class="stat"><b>${success}</b><span>সফলতা</span></div>
        <div class="stat"><b>${connectedCount}/4</b><span>সংযুক্ত প্ল্যাটফর্ম</span></div>
      </div>

      <section class="card">
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

      <section class="card">
        <h3>🎙️ ভয়েস কন্ট্রোল</h3>
        <p class="muted">মাইক চালু করে বলো — যেমন "Facebook খোলো", "ক্যাপশন বানাও", "কিউ দেখাও"।</p>
        <button id="micBtn">${listening ? '⏹️ ভয়েস বন্ধ করো' : '🎙️ ভয়েস চালু করো'}</button>
        <p id="voiceStatus" class="muted">${listening ? 'শুনছি… 🎧' : 'ভয়েস বন্ধ আছে'}</p>
        ${lastVoice ? `<p class="muted">শেষ কমান্ড: ${escapeHTML(lastVoice)}</p>` : ''}
        <p class="muted">চলবে: Facebook / YouTube / Instagram / Threads খোলো • ক্যাপশন বানাও • কিউ দেখাও • লগ দেখাও • উপরে যাও<br>নোট: Chrome ব্রাউজারে ভালো চলে; APK-তে ফোনের WebView অনুযায়ী নাও চলতে পারে।</p>
      </section>

      <section class="card">
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

      <section class="card">
        <h3>🗓️ পোস্ট প্ল্যানার</h3>
        <input id="postTitle" maxlength="240" placeholder="পোস্টের টাইটেল">
        <textarea id="postDesc" placeholder="বিবরণ / ক্যাপশন (ঐচ্ছিক)"></textarea>
        <select id="postPlatform">
          ${PLATFORMS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <input id="postWhen" type="datetime-local">
        <button id="addPost">কিউতে যোগ করো</button>
      </section>

      <section class="card">
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

      <section class="card">
        <h3>🌐 Browser</h3>
        <input id="url" placeholder="example.com অথবা https://example.com" autocomplete="url">
        <button id="open">ওয়েবসাইট খোলো</button>
        <input id="search" placeholder="Google-এ কী সার্চ করবে?">
        <button id="searchBtn" class="secondary">Google Search</button>
      </section>

      <section class="card">
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

      <section class="card">
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

      <section class="card">
        <h3>📊 Activity History</h3>
        <p id="historyCount" class="muted">মোট কাজ: ${tasks.length} • পাবলিশ: ${dash.published}</p>
        <button id="clearHistory" class="danger">সব ইতিহাস মুছুন</button>
      </section>

      <section class="card">
        <h3>🧾 অ্যাক্টিভিটি লগ</h3>
        <div id="logList">${dash.log.length ? dash.log.map(e => `
          <div class="logitem"><time>${escapeHTML(fmtTime(e.ts))}</time> — ${escapeHTML(e.text)}</div>`).join('') : '<p class="muted">এখনো কোনো অ্যাক্টিভিটি নেই।</p>'}
        </div>
        <button id="clearLog" class="secondary">লগ মুছুন</button>
      </section>

      <section class="card">
        <h3>⚙️ সেটিংস</h3>
        <button id="exportData" class="secondary">ডেটা এক্সপোর্ট (JSON)</button>
        <button id="clearAll" class="danger">সব ডেটা মুছুন</button>
        <p class="muted">OpenX Automation v2.0 • Prototype • কোনো পাসওয়ার্ড বা API key এখানে লিখবে না — টোকেন শুধু এই ডিভাইসে থাকে।</p>
      </section>
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

app.addEventListener('click', async event => {
  const target = event.target;

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
    } catch {
      alert('ঠিকানাটি সঠিক নয় অথবা Browser খোলা যায়নি।');
    }
    return;
  }
  if (target.id === 'searchBtn') {
    const query = document.querySelector('#search').value.trim();
    if (!query) return alert('সার্চের বিষয় লিখুন।');
    await Browser.open({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
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
