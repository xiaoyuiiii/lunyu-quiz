/* 《论语》精读 · 题库练习 —— 单页应用（无依赖）
   数据：questions.js（window.QUESTION_BANK）
   逻辑：core.js（window.QuizCore）
*/
(function () {
  'use strict';

  var DATA = window.QUESTION_BANK || { meta: {}, items: [] };
  var ITEMS = DATA.items || [];
  var META = DATA.meta || {};
  var core = window.QuizCore;

  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var LS = 'lunyu-quiz-v1';

  var TYPES = { single: '单选题', multi: '多选题', judge: '判断题' };
  var MODE = {
    order:   { name: '顺序练习', icon: '☰', desc: '从第 1 题起，按顺序作答' },
    shuffle: { name: '乱序练习', icon: '⇄', desc: '随机打乱，检验掌握程度' },
    wrong:   { name: '错题回顾', icon: '✗', desc: '只练最近答错的题，答对移出' },
    star:    { name: '我的收藏', icon: '★', desc: '练习标了星号的题目' },
    todo:    { name: '未做题目', icon: '◌', desc: '跳过做过的题，先过一遍' }
  };

  var byN = {};
  ITEMS.forEach(function (it) { byN[it.n] = it; });

  /* ---------------- 存储 ---------------- */
  var store = loadStore();
  var canStore = true;

  function loadStore() {
    var base = { v: 1, records: {}, stars: [], theme: null };
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          base.records = s.records || {};
          base.stars = Array.isArray(s.stars) ? s.stars : [];
          base.theme = s.theme || null;
        }
      }
    } catch (e) { /* 隐私模式等 */ }
    return base;
  }

  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify(store));
    } catch (e) {
      if (canStore) {
        canStore = false;
        toast('浏览器不允许本地存储，进度不会被保存');
      }
    }
  }

  /* ---------------- 状态 ---------------- */
  var ui = {
    view: 'home',
    filter: { types: 'all', from: '', to: '' }
  };
  var session = null;

  /* ---------------- 小工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function typeCounts() {
    var c = { single: 0, multi: 0, judge: 0 };
    ITEMS.forEach(function (it) { c[it.t] = (c[it.t] || 0) + 1; });
    return c;
  }

  function ansText(it) {
    return it.t === 'judge' ? it.a[0] : it.a.join('、');
  }

  function cur() {
    if (!session) return null;
    return session.queue[session.idx] || null;
  }

  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  function scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }

  function fmtTime(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m ? m + ' 分 ' + s + ' 秒' : s + ' 秒';
  }

  function clip(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ---------------- 路由 ---------------- */
  function render(scroll) {
    document.body.dataset.theme = store.theme || (isSystemDark() ? 'dark' : 'light');
    if (ui.view === 'practice') renderPractice();
    else if (ui.view === 'done') renderDone();
    else if (ui.view === 'wrong') renderList('wrong');
    else if (ui.view === 'star') renderList('star');
    else renderHome();
    if (scroll) scrollTop();
  }

  function isSystemDark() {
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var st = core.stats(ITEMS, store.records, store.stars);
    var c = typeCounts();
    var f = ui.filter;

    var modes = ['order', 'shuffle', 'wrong', 'star', 'todo'].map(function (m) {
      var n;
      if (m === 'wrong') n = st.wrong;
      else if (m === 'star') n = st.stars;
      else if (m === 'todo') n = st.todo;
      else n = st.total;
      var dis = (m === 'wrong' || m === 'star') && n === 0;
      return '<button class="mode" data-act="start" data-mode="' + m + '"' + (dis ? ' disabled' : '') + '>'
        + '<span class="ico">' + MODE[m].icon + '</span>'
        + '<span><span class="t">' + MODE[m].name + '</span><span class="d">' + MODE[m].desc + '</span></span>'
        + '<span class="n">' + n + ' 题</span>'
        + '</button>';
    }).join('');

    var chips = [['all', '全部'], ['single', '单选'], ['multi', '多选'], ['judge', '判断']].map(function (t) {
      return '<button class="chip" data-act="filter" data-type="' + t[0] + '" aria-pressed="'
        + (f.types === t[0]) + '">' + t[1] + '</button>';
    }).join('');

    app.innerHTML =
      '<header class="hero">'
      + '  <div class="hero-top">'
      + '    <span class="brand">《论语》精读</span>'
      + '    <button class="icon-btn" data-act="theme" title="切换深色 / 浅色">◐</button>'
      + '  </div>'
      + '  <h1>题库练习</h1>'
      + '  <p class="sub">共 ' + (META.count || ITEMS.length) + ' 题 · 单选 ' + c.single + ' · 多选 ' + c.multi
      + '   · 判断 ' + c.judge + ' · 答案已逐题校订</p>'
      + '  <div class="stats">'
      + '    <div class="stat"><div class="k">已做</div><div class="v">' + st.seen + '<span>/' + st.total + '</span></div></div>'
      + '    <div class="stat"><div class="k">正确率</div><div class="v">' + st.accuracy + '<span>%</span></div></div>'
      + '    <div class="stat"><div class="k">错题</div><div class="v">' + st.wrong + '</div></div>'
      + '    <div class="stat"><div class="k">收藏</div><div class="v">' + st.stars + '</div></div>'
      + '  </div>'
      + '</header>'

      + '<section class="panel">'
      + '  <h2>开始练习</h2>'
      + '  <div class="modes">' + modes + '</div>'
      + '</section>'

      + '<section class="panel">'
      + '  <h2>筛选范围</h2>'
      + '  <div class="chips">' + chips + '</div>'
      + '  <div class="range">'
      + '    <span class="small muted">题号</span>'
      + '    <input type="number" inputmode="numeric" min="1" max="' + ITEMS.length + '" placeholder="起" value="' + esc(f.from) + '" data-act="from">'
      + '    <span class="muted">—</span>'
      + '    <input type="number" inputmode="numeric" min="1" max="' + ITEMS.length + '" placeholder="止" value="' + esc(f.to) + '" data-act="to">'
      + '    <button class="btn ghost small" data-act="clear-filter">清除</button>'
      + '  </div>'
      + '  <p class="small muted" style="margin:10px 0 0">筛选只影响「顺序 / 乱序 / 未做」三种模式；错题与收藏按记录出题。</p>'
      + '</section>'

      + '<section class="panel">'
      + '  <h2>记录</h2>'
      + '  <div class="row">'
      + '    <button class="btn" data-act="view-wrong">错题本（' + st.wrong + '）</button>'
      + '    <button class="btn" data-act="view-star">收藏（' + st.stars + '）</button>'
      + '  </div>'
      + '  <div class="row" style="margin-top:10px">'
      + '    <button class="btn ghost small" data-act="export">导出进度</button>'
      + '    <button class="btn ghost small" data-act="import">导入进度</button>'
      + '    <button class="btn ghost small" data-act="reset">清空记录</button>'
      + '  </div>'
      + '</section>'

      + '<p class="foot">进度只保存在本机浏览器（localStorage），不上传任何数据。<br>'
      + '快捷键：<kbd>A</kbd>–<kbd>D</kbd> 选项 · <kbd>Enter</kbd> 提交 / 下一题 · <kbd>←</kbd><kbd>→</kbd> 前后题 · <kbd>S</kbd> 收藏</p>';
  }

  /* ---------------- 练习页 ---------------- */
  function renderPractice() {
    var s = session;
    if (!s || !s.queue.length) { ui.view = 'home'; return renderHome(); }

    var it = cur();
    var res = s.results[it.n];
    var pending = s.pending[it.n] || [];
    var starred = store.stars.indexOf(it.n) >= 0;
    var isLast = s.idx === s.queue.length - 1;
    var pct = Math.round(((s.idx + 1) / s.queue.length) * 100);

    var opts;
    if (it.t === 'judge') {
      opts = '<div class="opts">' + ['对', '错'].map(function (k) {
        var cls = 'opt judge';
        if (res) {
          if (it.a.indexOf(k) >= 0) cls += ' right';
          else if (res.picked.indexOf(k) >= 0) cls += ' wrong';
        } else if (pending.indexOf(k) >= 0) cls += ' picked';
        return '<button class="' + cls + '" data-act="pick" data-key="' + k + '"' + (res ? ' disabled' : '') + '>'
          + '<span class="txt">' + k + '</span></button>';
      }).join('') + '</div>';
    } else {
      opts = '<div class="opts">' + it.o.map(function (o) {
        var key = o[0];
        var cls = 'opt';
        if (res) {
          if (it.a.indexOf(key) >= 0) cls += ' right';
          else if (res.picked.indexOf(key) >= 0) cls += ' wrong';
        } else if (pending.indexOf(key) >= 0) cls += ' picked';
        return '<button class="' + cls + '" data-act="pick" data-key="' + esc(key) + '"' + (res ? ' disabled' : '') + '>'
          + '<span class="key">' + esc(key) + '</span><span class="txt">' + esc(o[1]) + '</span></button>';
      }).join('') + '</div>';
    }

    var fb = '';
    if (res) {
      fb = '<div class="fb ' + (res.ok ? 'ok' : 'bad') + '">'
        + '<div class="head"><span>' + (res.ok ? '✓ 回答正确' : '✗ 回答错误') + '</span>'
        + '<span class="ans">正确答案：' + esc(ansText(it)) + '</span></div>'
        + (it.e ? '<p class="exp"><b>依据：</b>' + esc(it.e) + '</p>' : '')
        + '</div>';
    }

    var dock;
    if (it.t === 'multi' && !res) {
      dock = '<div class="dock"><div class="inner">'
        + '<button class="btn" data-act="prev"' + (s.idx === 0 ? ' disabled' : '') + '>上一题</button>'
        + '<button class="btn ghost" data-act="next">跳过</button>'
        + '<button class="btn primary grow" data-act="submit"' + (pending.length ? '' : ' disabled') + '>提交答案</button>'
        + '</div></div>';
    } else if (!res) {
      dock = '<div class="dock"><div class="inner">'
        + '<button class="btn" data-act="prev"' + (s.idx === 0 ? ' disabled' : '') + '>上一题</button>'
        + '<button class="btn ghost grow" data-act="next">跳过</button>'
        + '</div></div>';
    } else {
      var nxt = isLast ? '完成本轮' : '下一题';
      dock = '<div class="dock"><div class="inner">'
        + '<button class="btn" data-act="prev"' + (s.idx === 0 ? ' disabled' : '') + '>上一题</button>'
        + '<button class="btn primary grow" data-act="next">' + nxt + '</button>'
        + '</div></div>';
    }

    var hint = '';
    if (!res) {
      if (it.t === 'multi') hint = '多选题：可选多项，选好后按 <kbd>Enter</kbd> 或点「提交答案」';
      else if (it.t === 'judge') hint = '按 <kbd>1</kbd> 选「对」，<kbd>2</kbd> 选「错」';
      else hint = '按 <kbd>A</kbd>–<kbd>' + String.fromCharCode(64 + it.o.length) + '</kbd> 或 <kbd>1</kbd>–<kbd>' + it.o.length + '</kbd> 作答';
    }

    app.innerHTML =
      '<div class="bar">'
      + '  <button class="back" data-act="home" title="返回首页">←</button>'
      + '  <div class="mid"><span class="mode-name">' + esc(s.label) + '</span>'
      + '    <button class="counter" data-act="jump" title="跳转到题号">' + (s.idx + 1) + '<em> / ' + s.queue.length + '</em></button></div>'
      + '  <button class="star" data-act="star" aria-pressed="' + starred + '" title="收藏本题">'
      + (starred ? '★' : '☆') + '</button>'
      + '</div>'
      + '<div class="progress"><i style="width:' + pct + '%"></i></div>'
      + '<div class="qcard">'
      + '  <div class="qtag"><b>第 ' + it.n + ' 题</b><span>·</span><span>' + TYPES[it.t] + '</span>'
      + (it.e ? '<span>·</span><span>含解析</span>' : '') + '</div>'
      + '  <p class="stem">' + esc(it.q) + '</p>'
      + opts
      + fb
      + '</div>'
      + (hint ? '<p class="kbd-hint">' + hint + '</p>' : '')
      + dock;
  }

  /* ---------------- 结果页 ---------------- */
  function renderDone() {
    var d = session && session.done;
    if (!d) { ui.view = 'home'; return renderHome(); }
    var acc = d.answered ? Math.round((d.right / d.answered) * 100) : 0;

    var wrongHtml = d.wrongItems.length
      ? '<section class="panel"><h2>本轮错题（' + d.wrongItems.length + '）</h2><div class="list">'
        + d.wrongItems.map(function (n) {
          var it = byN[n];
          return '<div class="item"><div><div class="no">第 ' + n + ' 题 · ' + TYPES[it.t] + '</div>'
            + '<p class="q">' + esc(clip(it.q, 52)) + '</p>'
            + '<div class="meta">正确答案 <span class="oktxt">' + esc(ansText(it)) + '</span></div></div></div>';
        }).join('')
        + '</div></section>'
      : '<section class="panel"><div class="empty">本轮没有错题，继续保持 🎉</div></section>';

    app.innerHTML =
      '<div class="result-head"><h1>本轮完成</h1>'
      + '<p class="sub">' + esc(session.label) + ' · 用时 ' + fmtTime(d.ms) + '</p></div>'
      + '<div class="big-stats">'
      + '  <div class="stat"><div class="k">作答</div><div class="v">' + d.answered + '<span>/' + d.total + '</span></div></div>'
      + '  <div class="stat"><div class="k">正确</div><div class="v">' + d.right + '</div></div>'
      + '  <div class="stat"><div class="k">正确率</div><div class="v">' + acc + '<span>%</span></div></div>'
      + '</div>'
      + wrongHtml
      + '<div class="dock"><div class="inner">'
      + '  <button class="btn" data-act="home">返回首页</button>'
      + (d.wrongItems.length ? '<button class="btn" data-act="replay-wrong">重练错题</button>' : '')
      + '<button class="btn primary grow" data-act="retry">再来一轮</button>'
      + '</div></div>';
  }

  /* ---------------- 列表页（错题 / 收藏） ---------------- */
  function renderList(kind) {
    var isWrong = kind === 'wrong';
    var ids = ITEMS.filter(function (it) {
      var r = store.records[it.n];
      return isWrong ? (r && r.last === 'wrong') : (store.stars.indexOf(it.n) >= 0);
    }).map(function (it) { return it.n; });

    var title = isWrong ? '错题本' : '我的收藏';

    var rows = ids.map(function (n) {
      var it = byN[n];
      var r = store.records[n] || {};
      var meta = isWrong
        ? '<div class="meta">已错 ' + (r.wrong || 1) + ' 次 · 正确答案 <span class="oktxt">' + esc(ansText(it)) + '</span></div>'
        : '<div class="meta">' + TYPES[it.t] + ' · 正确答案 <span class="oktxt">' + esc(ansText(it)) + '</span></div>';
      return '<div class="item">'
        + '<div><div class="no">第 ' + n + ' 题 · ' + TYPES[it.t] + '</div>'
        + '<p class="q">' + esc(clip(it.q, 56)) + '</p>' + meta + '</div>'
        + '<button class="btn ghost small" data-act="from-list" data-kind="' + kind + '" data-n="' + n + '">练</button>'
        + '</div>';
    }).join('');

    app.innerHTML =
      '<div class="bar"><button class="back" data-act="home">←</button>'
      + '<div class="mid"><span class="mode-name">' + title + '</span>'
      + '<span class="counter">' + ids.length + '<em> 题</em></span></div>'
      + '<button class="star" data-act="theme" title="切换主题">◐</button></div>'
      + (ids.length
          ? '<div class="row" style="margin:16px 0 14px">'
            + '<button class="btn primary" data-act="start-list" data-kind="' + kind + '">开始' + (isWrong ? '复习' : '练习') + '（' + ids.length + ' 题）</button>'
            + (isWrong ? '<button class="btn ghost" data-act="clear-wrong">清空错题</button>' : '<button class="btn ghost" data-act="clear-star">清空收藏</button>')
            + '</div>'
            + '<div class="list">' + rows + '</div>'
          : '<div class="empty">' + (isWrong ? '还没有错题，去练习吧' : '还没有收藏，答题时点右上角 ☆ 即可') + '</div>');
  }

  /* ---------------- 会话控制 ---------------- */
  function start(mode, opts) {
    opts = opts || {};
    var queue = opts.queue;
    if (!queue) {
      queue = core.buildQueue(ITEMS, mode, {
        types: ui.filter.types,
        from: ui.filter.from,
        to: ui.filter.to,
        records: store.records,
        stars: store.stars
      });
    }
    if (!queue.length) {
      toast(mode === 'wrong' ? '错题本还是空的' : mode === 'star' ? '还没有收藏题目' : '没有符合条件的题目');
      return;
    }
    var startIdx = 0;
    if (opts.startN) {
      for (var i = 0; i < queue.length; i++) { if (queue[i].n === opts.startN) { startIdx = i; break; } }
    }
    session = {
      mode: mode,
      label: opts.label || MODE[mode].name,
      queue: queue,
      idx: startIdx,
      results: {},
      pending: {},
      startedAt: Date.now(),
      done: null
    };
    ui.view = 'practice';
    render(true);
  }

  function pick(key) {
    var it = cur();
    if (!it || session.results[it.n]) return;
    if (it.t === 'multi') {
      var arr = session.pending[it.n] || (session.pending[it.n] = []);
      var i = arr.indexOf(key);
      if (i >= 0) arr.splice(i, 1); else arr.push(key);
      renderPractice();
    } else {
      submit([key]);
    }
  }

  function submit(picked) {
    var it = cur();
    if (!it || session.results[it.n]) return;
    picked = (picked || session.pending[it.n] || []).slice();
    if (!picked.length) return;

    var ok = core.isCorrect(it, picked);
    session.results[it.n] = { picked: picked, ok: ok };

    var r = store.records[it.n] || { right: 0, wrong: 0 };
    if (ok) { r.right = (r.right || 0) + 1; r.last = 'right'; }
    else { r.wrong = (r.wrong || 0) + 1; r.last = 'wrong'; }
    r.ts = Date.now();
    store.records[it.n] = r;
    save();

    renderPractice();
    var fb = document.querySelector('.fb');
    if (fb && fb.scrollIntoView) {
      try { fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
  }

  function next() {
    var s = session;
    if (!s) return;
    if (s.idx < s.queue.length - 1) {
      s.idx += 1;
      render(true);
    } else {
      finish();
    }
  }

  function prev() {
    var s = session;
    if (!s || s.idx === 0) return;
    s.idx -= 1;
    render(true);
  }

  function finish() {
    var s = session;
    if (!s) return;
    var answered = 0, right = 0, wrongItems = [];
    s.queue.forEach(function (it) {
      var r = s.results[it.n];
      if (!r) return;
      answered += 1;
      if (r.ok) right += 1; else wrongItems.push(it.n);
    });
    s.done = {
      total: s.queue.length,
      answered: answered,
      right: right,
      wrongItems: wrongItems.sort(function (a, b) { return a - b; }),
      ms: Date.now() - s.startedAt
    };
    ui.view = 'done';
    render(true);
  }

  function toggleStar() {
    var it = cur();
    if (!it) return;
    var i = store.stars.indexOf(it.n);
    if (i >= 0) { store.stars.splice(i, 1); toast('已取消收藏'); }
    else { store.stars.push(it.n); toast('已收藏'); }
    save();
    renderPractice();
  }

  /* ---------------- 导入导出 ---------------- */
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object') throw new Error('bad');
        if (data.records && typeof data.records === 'object') store.records = data.records;
        if (Array.isArray(data.stars)) store.stars = data.stars;
        save();
        toast('进度已导入');
        render(false);
      } catch (e) {
        toast('文件格式不正确');
      }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });

  function exportData() {
    var payload = { app: 'lunyu-quiz', v: 1, exportedAt: new Date().toISOString(), records: store.records, stars: store.stars };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lunyu-progress-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('已导出进度文件');
  }

  /* ---------------- 事件 ---------------- */
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-act');

    if (act === 'theme') {
      store.theme = (document.body.dataset.theme === 'dark') ? 'light' : 'dark';
      save();
      document.body.dataset.theme = store.theme;
      return;
    }
    if (act === 'start') { start(el.getAttribute('data-mode')); return; }
    if (act === 'filter') {
      ui.filter.types = el.getAttribute('data-type');
      render(false);
      return;
    }
    if (act === 'clear-filter') {
      ui.filter = { types: 'all', from: '', to: '' };
      render(false);
      return;
    }
    if (act === 'pick') { pick(el.getAttribute('data-key')); return; }
    if (act === 'submit') { submit(); return; }
    if (act === 'next') { next(); return; }
    if (act === 'prev') { prev(); return; }
    if (act === 'star') { toggleStar(); return; }
    if (act === 'jump') {
      var input = window.prompt('跳到第几题？（1–' + session.queue.length + '）', String(session.idx + 1));
      if (input == null) return;
      var k = parseInt(String(input).replace(/\D/g, ''), 10);
      if (!k || k < 1 || k > session.queue.length) { toast('题号超出范围'); return; }
      session.idx = k - 1;
      render(true);
      return;
    }
    if (act === 'home') { ui.view = 'home'; session = null; render(true); return; }
    if (act === 'view-wrong') { ui.view = 'wrong'; render(true); return; }
    if (act === 'view-star') { ui.view = 'star'; render(true); return; }
    if (act === 'start-list') {
      var kind = el.getAttribute('data-kind');
      start(kind === 'wrong' ? 'wrong' : 'star');
      return;
    }
    if (act === 'from-list') {
      var k = el.getAttribute('data-kind');
      var n = Number(el.getAttribute('data-n'));
      start(k === 'wrong' ? 'wrong' : 'star', { startN: n });
      return;
    }
    if (act === 'clear-wrong') {
      if (!confirm('清空错题记录？已做记录会保留，但错题本会清空。')) return;
      Object.keys(store.records).forEach(function (n) {
        var r = store.records[n];
        if (r && r.last === 'wrong') {
          if (r.right) r.last = 'right'; else delete store.records[n];
        }
      });
      save(); render(false); toast('错题已清空');
      return;
    }
    if (act === 'clear-star') {
      if (!confirm('清空全部收藏？')) return;
      store.stars = []; save(); render(false); toast('收藏已清空');
      return;
    }
    if (act === 'retry') { start(session.mode === 'wrong' || session.mode === 'star' ? session.mode : session.mode); return; }
    if (act === 'replay-wrong') {
      var q = session.done.wrongItems.map(function (n) { return byN[n]; });
      start('wrong', { queue: q, label: '错题重练' });
      return;
    }
    if (act === 'export') { exportData(); return; }
    if (act === 'import') { fileInput.click(); return; }
    if (act === 'reset') {
      if (!confirm('清空全部记录（含错题与收藏）？此操作不可撤销。')) return;
      store.records = {}; store.stars = []; save(); render(false); toast('已清空');
      return;
    }
  });

  // 题号范围输入
  app.addEventListener('input', function (e) {
    var el = e.target;
    if (el.getAttribute('data-act') === 'from') ui.filter.from = el.value.replace(/\D/g, '').slice(0, 3);
    if (el.getAttribute('data-act') === 'to') ui.filter.to = el.value.replace(/\D/g, '').slice(0, 3);
  });

  document.addEventListener('keydown', function (e) {
    if (ui.view !== 'practice' || !session) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var it = cur();
    if (!it) return;
    var key = e.key;
    var answered = !!session.results[it.n];

    if (key === 'Enter') {
      e.preventDefault();
      if (!answered && it.t === 'multi') submit();
      else if (answered) next();
      return;
    }
    if (key === 'ArrowRight') { e.preventDefault(); next(); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); prev(); return; }
    if (key === 's' || key === 'S') { toggleStar(); return; }

    var pool = it.t === 'judge' ? ['对', '错'] : it.o.map(function (o) { return o[0]; });
    var idx = -1;
    if (/^[1-9]$/.test(key)) idx = Number(key) - 1;
    else if (/^[a-dA-D]$/.test(key)) idx = key.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < pool.length && !answered) {
      e.preventDefault();
      pick(pool[idx]);
    }
  });

  /* ---------------- 启动 ---------------- */
  render(false);
})();

