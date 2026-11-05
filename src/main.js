import { Browser } from '@capacitor/browser';

const app = document.querySelector('#app');
const STORAGE_KEY = 'openx_tasks_v1';

let tasks = loadTasks();

function loadTasks() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function render() {
  app.innerHTML = `
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#101827;color:#f4f7fb;font-family:system-ui,Arial,sans-serif}
      .wrap{padding:18px;max-width:680px;margin:auto}
      h1{color:#54d6a0;margin-bottom:4px}
      .muted{color:#b8c5d6;font-size:13px;line-height:1.5}
      .card{background:#1b293d;padding:16px;margin:14px 0;border-radius:14px}
      input,select{width:100%;padding:13px;margin:8px 0;border:1px solid #506078;border-radius:9px;background:#101827;color:white;font-size:16px}
      button{border:0;border-radius:9px;padding:12px 14px;margin:5px 4px 5px 0;background:#54d6a0;color:#10221b;font-weight:700;font-size:14px}
      button.secondary{background:#354963;color:white}
      button.danger{background:#b94343;color:white}
      .task{border:1px solid #40536d;padding:12px;border-radius:10px;margin-top:10px;overflow-wrap:anywhere}
      .status{font-size:12px;color:#c5d4e7}
      .pill{display:inline-block;background:#263b55;padding:4px 8px;border-radius:20px;font-size:11px}
      .row{display:flex;gap:8px;flex-wrap:wrap}
      .row button{flex:1}
      .notice{border-left:3px solid #e6b450;padding:8px 10px;background:#263247;border-radius:5px}
    </style>
    <div class="wrap">
      <h1>OpenX Automation</h1>
      <div class="muted">তোমার ব্যক্তিগত Browser ও Automation Task Manager</div>

      <section class="card">
        <h3>🌐 Browser</h3>
        <input id="url" placeholder="example.com অথবা https://example.com" autocomplete="url">
        <button id="open">ওয়েবসাইট খোলো</button>
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
        <div id="taskList"></div>
      </section>

      <section class="card">
        <h3>📊 Activity History</h3>
        <p id="historyCount" class="muted"></p>
        <button id="clearHistory" class="danger">সব ইতিহাস মুছুন</button>
      </section>

      <p class="muted">OpenX Automation v1.0 • Prototype • কোনো পাসওয়ার্ড বা API key এখানে লিখবে না।</p>
    </div>
  `;

  const list = document.querySelector('#taskList');
  list.innerHTML = tasks.length ? tasks.map(task => `
    <article class="task">
      <b>${escapeHTML(task.title)}</b>
      <p class="status">
        <span class="pill">${escapeHTML(task.type)}</span>
        <br>অবস্থা: ${escapeHTML(task.status)}
        <br>সময়: ${escapeHTML(new Date(task.createdAt).toLocaleString())}
      </p>
      ${task.status === 'Pending approval' ? `
        <button data-approve="${task.id}">Approve</button>
        <button class="danger" data-reject="${task.id}">Reject</button>
      ` : ''}
    </article>
  `).join('') : '<p class="muted">এখনো কোনো কাজ যোগ করা হয়নি।</p>';

  document.querySelector('#historyCount').textContent = `মোট কাজ: ${tasks.length}`;
}

app.addEventListener('click', async event => {
  const target = event.target;

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
  }

  if (target.id === 'searchBtn') {
    const query = document.querySelector('#search').value.trim();
    if (!query) return alert('সার্চের বিষয় লিখুন।');
    await Browser.open({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
  }

  if (target.id === 'addTask') {
    const title = document.querySelector('#taskTitle').value.trim();
    const type = document.querySelector('#taskType').value;
    if (!title) return alert('কাজের নির্দেশ লিখুন।');
    tasks.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      type,
      status: 'Pending approval',
      createdAt: new Date().toISOString()
    });
    saveTasks();
    render();
  }

  if (target.dataset.approve) {
    const task = tasks.find(item => item.id === target.dataset.approve);
    if (task && confirm('এই কাজটি অনুমোদন হিসেবে চিহ্নিত করবেন?')) {
      task.status = 'Approved — not executed';
      saveTasks();
      render();
    }
  }

  if (target.dataset.reject) {
    const task = tasks.find(item => item.id === target.dataset.reject);
    if (task && confirm('এই কাজটি বাতিল করবেন?')) {
      task.status = 'Rejected';
      saveTasks();
      render();
    }
  }

  if (target.id === 'clearHistory' && confirm('সব কাজের ইতিহাস মুছে ফেলবেন?')) {
    tasks = [];
    saveTasks();
    render();
  }
});

render();