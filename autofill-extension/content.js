/*
 * 表单秒填 Autofill Kit —— 本地扩展版内容脚本
 * 与油猴版逻辑一致，存储改用 chrome.storage.local（按域名隔离）
 * 验证注入：页面控制台查 localStorage 的 afk:injected
 * 只填字段，不会点击任何提交/支付按钮。
 */

(async function () {
  'use strict';

  /* 注入标记：供远程验证脚本是否真正运行 */
  try { localStorage.setItem('afk:injected', new Date().toISOString()); } catch (e) {}

  /* ===== 1. 个人资料（关键词兜底匹配用，改成你自己的） ===== */
  const PROFILE = {
    '姓名': '张三',
    '姓氏': '张',
    '名字': '三',
    '手机': '13800138000',
    '邮箱': 'you@example.com',
    '地址': '北京市朝阳区幸福路 1 号',
    '邮编': '100000',
    '省份': '',
    '城市': '',
    '区县': '',
  };
  /* 顺序有讲究：姓名的规则要在姓/名之前，避免"姓名"被拆开匹配 */
  const KEYWORDS = [
    [/姓名|联系人|收货人|称呼|full[_-]?name|contact[_-]?name|recipient[_-]?name|ship[_-]?to[_-]?name/i, '姓名'],
    [/姓氏|surname|family[_-]?name|last[_-]?name/i, '姓氏'],
    [/名字|given[_-]?name|first[_-]?name/i, '名字'],
    [/手机|电话|联系方式|phone|tel|mobile/i, '手机'],
    [/邮箱|电子邮件|email/i, '邮箱'],
    [/地址|街道|门牌|address|street/i, '地址'],
    [/邮编|邮政|zip|postal/i, '邮编'],
    [/省份|自治区|province|state/i, '省份'],
    [/城市|city/i, '城市'],
    [/区县|行政区|乡镇|district|county|suburb/i, '区县'],
  ];
  const SKIP_FIELD = /captcha|验证码|password|密码|card|卡号|cvv|cvc/i;

  /* ===== 2. 按域名存取配置（chrome.storage.local，按域名键隔离） ===== */
  const domain = location.hostname;
  const KEY = 'afk:cfg:' + domain;
  const store = {
    async get(k, d) {
      const o = await chrome.storage.local.get(k);
      return o[k] !== undefined ? o[k] : d;
    },
    set(k, v) { return chrome.storage.local.set({ [k]: v }); },
  };
  let cfg = await store.get(KEY, { enabled: false, mapping: [] });
  const saveCfg = () => store.set(KEY, cfg);

  /* ===== 3. 框架安全的赋值（兼容 React/Vue 受控组件） ===== */
  function setValue(el, v) {
    if (el.tagName === 'SELECT') {
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === String(v);
    }
    if (el.type === 'checkbox') {
      if (el.checked !== !!v) el.click();
      return true;
    }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === String(v);
  }

  function highlight(el) {
    const bak = el.style.outline;
    el.style.outline = '2px solid #22c55e';
    el.style.outlineOffset = '1px';
    setTimeout(() => { el.style.outline = bak; }, 1500);
  }

  /* ===== 4. 字段收集与选择器生成 ===== */
  function visibleFields() {
    const out = [];
    for (const el of document.querySelectorAll('input, textarea, select')) {
      if (['hidden', 'submit', 'button', 'image', 'reset'].includes(el.type)) continue;
      if (el.readOnly || el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      out.push(el);
    }
    return out;
  }

  const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  function labelOf(el) {
    if (el.labels && el.labels[0]) return el.labels[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.placeholder) return el.placeholder;
    const wrap = el.closest('label, .form-item, .field, li, td, div');
    if (wrap) {
      const t = (wrap.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length < 50) return t;
    }
    return '';
  }

  function selectorOf(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const name = el.getAttribute('name');
    if (name) {
      if (el.type === 'radio') return `[name="${q(name)}"][value="${q(el.value)}"]`;
      return `[name="${q(name)}"]`;
    }
    const path = [];
    let node = el;
    while (node && node !== document.body && path.length < 5) {
      let seg = node.tagName.toLowerCase();
      if (node.id) { path.unshift('#' + CSS.escape(node.id)); break; }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) seg += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      path.unshift(seg);
      node = node.parentElement;
    }
    return path.join(' > ');
  }

  function scan() {
    return visibleFields().map((el) => ({
      selector: selectorOf(el),
      label: labelOf(el),
      type: el.type || el.tagName.toLowerCase(),
      autocomplete: el.getAttribute('autocomplete') || '',
      value: el.value || '',
    }));
  }

  /* ===== 5. 填充：先按保存的映射，再用关键词兜底 ===== */
  function keywordMatch(el) {
    const hay = [el.name, el.id, el.placeholder, el.getAttribute('autocomplete'), labelOf(el)]
      .join(' ')
      .toLowerCase();
    for (const [re, key] of KEYWORDS) {
      if (re.test(hay) && PROFILE[key]) return PROFILE[key];
    }
    return null;
  }

  function fill() {
    const fields = visibleFields();
    const report = { ok: 0, kw: 0, miss: [] };
    if (fields.length === 0) return report;

    const used = new Set();
    for (const m of cfg.mapping) {
      const el = document.querySelector(m.selector);
      if (!el || !fields.includes(el)) { report.miss.push(m.selector); continue; }
      if (el.type === 'radio') {
        if (String(m.value) === el.value && !el.checked) el.click();
        report.ok++; used.add(el); highlight(el);
        continue;
      }
      if (setValue(el, m.value)) { report.ok++; used.add(el); highlight(el); }
      else report.miss.push(m.selector);
    }

    for (const el of fields) {
      if (used.has(el) || el.value) continue;
      if (['radio', 'checkbox', 'file', 'password'].includes(el.type)) continue;
      if (SKIP_FIELD.test([el.name, el.id, el.placeholder, labelOf(el)].join(' '))) continue;
      const v = keywordMatch(el);
      if (v != null && setValue(el, v)) { report.kw++; highlight(el); }
    }
    return report;
  }

  /* ===== 6. 自动触发：进入页面即填，支持 SPA 动态渲染 ===== */
  let filled = false;
  function tryAuto() {
    if (filled || !cfg.enabled) return;
    if (visibleFields().length === 0) return;
    filled = true;
    fill();
  }
  tryAuto();
  new MutationObserver(() => tryAuto()).observe(document.body, { childList: true, subtree: true });
  // SPA 路由切换后允许重新填充
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function (...a) { const r = orig.apply(this, a); filled = false; return r; };
  }
  addEventListener('popstate', () => { filled = false; });

  /* ===== 7. 悬浮面板 ===== */
  const UI = {};
  const BTN = 'flex:1;padding:4px 0;border:1px solid #ddd;border-radius:6px;background:#f6f6f6;cursor:pointer;font-size:12px';

  function status(msg) { if (UI.status) UI.status.textContent = msg; }

  function buildPanel() {
    if (UI.root) return;
    const root = document.createElement('div');
    root.id = 'afk-panel';
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;font:12px/1.6 -apple-system,system-ui,sans-serif;color:#111';
    root.innerHTML = `
      <div style="width:240px;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.18);overflow:hidden">
        <div style="display:flex;align-items:center;padding:5px 10px;background:#111;color:#fff">
          <b style="flex:1">表单秒填</b>
          <span data-act="collapse" style="cursor:pointer;padding:0 4px">—</span>
          <span data-act="hide" style="cursor:pointer;padding:0 4px">×</span>
        </div>
        <div data-body style="padding:8px 10px">
          <div data-status style="min-height:18px;color:#666">就绪</div>
          <div style="display:flex;gap:6px;margin:6px 0">
            <button data-act="fill" style="${BTN}">填充</button>
            <button data-act="scan" style="${BTN}">抓取</button>
            <button data-act="toggle" style="${BTN}">自动:关</button>
          </div>
          <div style="display:flex;gap:6px">
            <button data-act="edit" style="${BTN}">编辑配置</button>
          </div>
          <textarea data-ta rows="7" spellcheck="false"
            style="display:none;width:100%;box-sizing:border-box;margin-top:6px;font:11px/1.5 Menlo,monospace;border:1px solid #ddd;border-radius:6px;padding:4px"></textarea>
          <button data-act="save" style="display:none;width:100%;margin-top:6px;padding:4px 0;border:none;border-radius:6px;background:#111;color:#fff;cursor:pointer">保存配置</button>
        </div>
      </div>`;
    document.body.appendChild(root);

    UI.root = root;
    UI.status = root.querySelector('[data-status]');
    UI.body = root.querySelector('[data-body]');
    UI.ta = root.querySelector('[data-ta]');
    UI.save = root.querySelector('[data-act="save"]');
    UI.toggle = root.querySelector('[data-act="toggle"]');
    syncUI();

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
      if (!act) return;
      if (act === 'fill') {
        const r = fill();
        status(r.ok + r.kw === 0 ? '页面上没有可填的输入框' : `配置命中 ${r.ok}，关键词 ${r.kw}${r.miss.length ? `，未找到 ${r.miss.length}` : ''}`);
      } else if (act === 'scan') {
        scanAndCopy();
      } else if (act === 'toggle') {
        cfg.enabled = !cfg.enabled;
        saveCfg();
        syncUI();
        status(cfg.enabled ? '自动填充已开启' : '自动填充已关闭');
        if (cfg.enabled) { filled = false; tryAuto(); }
      } else if (act === 'edit') {
        const show = UI.ta.style.display === 'none';
        UI.ta.style.display = show ? 'block' : 'none';
        UI.save.style.display = show ? 'block' : 'none';
        if (show && !UI.ta.value) UI.ta.value = JSON.stringify(cfg.mapping, null, 2);
      } else if (act === 'save') {
        try {
          const arr = JSON.parse(UI.ta.value);
          if (!Array.isArray(arr)) throw new Error('not array');
          cfg.mapping = arr.filter((x) => x && x.selector);
          saveCfg();
          UI.ta.style.display = 'none';
          UI.save.style.display = 'none';
          status(`已保存 ${cfg.mapping.length} 条映射`);
        } catch {
          status('JSON 解析失败，请检查格式');
        }
      } else if (act === 'collapse') {
        UI.body.style.display = UI.body.style.display === 'none' ? 'block' : 'none';
      } else if (act === 'hide') {
        root.remove();
        UI.root = null;
      }
    });
  }

  function syncUI() {
    if (UI.toggle) UI.toggle.textContent = cfg.enabled ? '自动:开' : '自动:关';
  }

  function scanAndCopy() {
    const s = scan();
    UI.ta.value = JSON.stringify(s, null, 2);
    UI.ta.style.display = 'block';
    UI.save.style.display = 'block';
    try { navigator.clipboard.writeText(JSON.stringify(s, null, 2)); } catch {}
    status(s.length ? `抓到 ${s.length} 个字段，已填入编辑框（复制到剪贴板）` : '页面上没有可见输入框');
  }

  function togglePanel() {
    if (UI.root) { UI.root.remove(); UI.root = null; }
    else buildPanel();
  }

  /* ===== 8. 快捷键 ===== */
  addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyF') { const r = fill(); status(`填充完成：配置 ${r.ok}，关键词 ${r.kw}`); }
    else if (e.code === 'KeyC') scanAndCopy();
    else if (e.code === 'KeyE') {
      cfg.enabled = !cfg.enabled; saveCfg(); syncUI();
      if (cfg.enabled) { filled = false; tryAuto(); }
    } else if (e.code === 'KeyH') togglePanel();
  });

  if (window.top === window) buildPanel();
})();
