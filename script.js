
(() => {
  const $ = s => document.querySelector(s);
  const ENGINES = {
    wiki: { n: 'Wikipedia', u: q => 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q), embed: true },
    ddg: { n: 'DuckDuckGo', u: q => 'https://duckduckgo.com/?q=' + encodeURIComponent(q), embed: false },
    google: { n: 'Google', u: q => 'https://www.google.com/search?q=' + encodeURIComponent(q), embed: false },
    bing: { n: 'Bing', u: q => 'https://www.bing.com/search?q=' + encodeURIComponent(q), embed: false }
  };
  const DIAL = [['Wikipedia', 'https://en.wikipedia.org'], ['OpenStreetMap', 'https://www.openstreetmap.org'], ['MDN', 'https://developer.mozilla.org'], ['Archive.org', 'https://archive.org'], ['Example', 'https://example.com'], ['Hacker News', 'https://news.ycombinator.com']];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('drift:' + k); return v ? JSON.parse(v) : d } catch (e) { return d } },
    set(k, v) { try { localStorage.setItem('drift:' + k, JSON.stringify(v)) } catch (e) { } }
  };
  let marks = store.get('marks', [{ t: 'Wikipedia', u: 'https://en.wikipedia.org' }, { t: 'MDN', u: 'https://developer.mozilla.org' }]);
  let history = store.get('history', []);
  let engine = store.get('engine', 'wiki');
  let tabs = [], cur = null, uid = 0, panel = null;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') || u } catch (e) { return u } };

  function resolve(input) {
    input = input.trim();
    if (!input) return '';
    if (input === 'about:home') return input;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
    if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/|$)/.test(input)) return 'http://' + input;
    if (/^[^\s]+\.[a-z]{2,}(:\d+)?([\/?#].*)?$/i.test(input)) return 'https://' + input;
    return ENGINES[engine].u(input);
  }

  function newTab(url = 'about:home', focus = true) {
    const t = { id: ++uid, stack: [], i: -1, title: 'New tab', frame: null, el: null };
    tabs.push(t);
    render();
    navigate(t, url, true);
    if (focus) activate(t);
    return t;
  }

  function navigate(t, input, push) {
    const url = resolve(input);
    if (!url) return;
    const ext = ENGINES.ddg.u('x').slice(0, 20);
    // Search engines that refuse to be embedded open in a real tab instead.
    for (const k in ENGINES) {
      const e = ENGINES[k];
      if (!e.embed && url.startsWith(e.u('').split('?')[0] + '?') && url.startsWith(e.u('x').slice(0, e.u('x').indexOf('x')))) {
        window.open(url, '_blank', 'noopener');
        if (t.i < 0) goHome(t);
        return;
      }
    }
    if (push) { t.stack = t.stack.slice(0, t.i + 1); t.stack.push(url); t.i = t.stack.length - 1 }
    show(t);
  }

  function goHome(t) { t.stack = t.stack.slice(0, t.i + 1); t.stack.push('about:home'); t.i = t.stack.length - 1; show(t) }

  function show(t) {
    const url = t.stack[t.i];
    const isHome = url === 'about:home';
    if (isHome) {
      t.title = 'New tab';
      if (t.frame) { t.frame.remove(); t.frame = null }
    } else {
      t.title = host(url);
      if (!t.frame) {
        const f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads');
        f.setAttribute('referrerpolicy', 'no-referrer');
        f.title = 'Page';
        f.style.display = 'none';
        f.addEventListener('load', () => { if (t === cur) setLoading(false) });
        $('#views').appendChild(f);
        t.frame = f;
      }
      if (t === cur || true) {
        setLoading(t === cur);
        t.frame.src = url;
      }
      addHistory(url, t.title);
    }
    if (t === cur) activate(t); else render();
  }

  function activate(t) {
    cur = t;
    tabs.forEach(x => { if (x.frame) x.frame.style.display = x === t ? 'block' : 'none' });
    const url = t.stack[t.i];
    const home = url === 'about:home';
    $('#homepage').style.display = home ? 'block' : 'none';
    $('#addr').value = home ? '' : url;
    $('#back').disabled = t.i <= 0;
    $('#fwd').disabled = t.i >= t.stack.length - 1;
    $('#ext').disabled = home;
    $('#hint').style.display = home ? 'none' : 'block';
    clearTimeout(activate.h);
    if (!home) activate.h = setTimeout(() => { $('#hint').style.display = 'none' }, 9000);
    $('#star').innerHTML = marks.some(m => m.u === url) ? '&#9733;' : '&#9734;';
    document.title = t.title + ' - Drift';
    render();
    if (home) $('#hq').focus();
  }

  function setLoading(on) {
    const l = $('#load');
    if (on) { l.style.transition = 'none'; l.style.width = '0'; requestAnimationFrame(() => { l.style.transition = 'width .6s'; l.style.width = '80%' }) }
    else { l.style.width = '100%'; setTimeout(() => { l.style.transition = 'none'; l.style.width = '0' }, 300) }
  }

  function render() {
    const bar = $('#tabs');
    [...bar.querySelectorAll('.tab')].forEach(n => n.remove());
    tabs.forEach(t => {
      const d = document.createElement('div');
      d.className = 'tab' + (t === cur ? ' on' : '');
      d.setAttribute('role', 'tab');
      d.innerHTML = '<span>' + esc(t.title) + '</span><button aria-label="Close tab">&#10005;</button>';
      d.onclick = () => activate(t);
      d.onauxclick = e => { if (e.button === 1) closeTab(t) };
      d.querySelector('button').onclick = e => { e.stopPropagation(); closeTab(t) };
      bar.insertBefore(d, $('#add'));
    });
  }

  function closeTab(t) {
    const i = tabs.indexOf(t);
    if (t.frame) t.frame.remove();
    tabs.splice(i, 1);
    if (!tabs.length) { newTab(); return }
    if (t === cur) activate(tabs[Math.min(i, tabs.length - 1)]); else render();
  }

  function addHistory(url, title) {
    history = history.filter(h => h.u !== url);
    history.unshift({ u: url, t: title, at: Date.now() });
    history = history.slice(0, 200);
    store.set('history', history);
  }

  function renderMarks() {
    const m = $('#marks');
    m.innerHTML = '';
    if (!marks.length) { m.innerHTML = '<i>Press the star to bookmark a page.</i>'; return }
    marks.forEach(b => {
      const x = document.createElement('button');
      x.textContent = b.t; x.title = b.u;
      x.onclick = () => navigate(cur, b.u, true);
      m.appendChild(x);
    });
  }

  function renderDial() {
    $('#dial').innerHTML = '';
    DIAL.forEach(([n, u]) => {
      const b = document.createElement('button');
      b.innerHTML = '<b>' + esc(n[0]) + '</b><span>' + esc(n) + '</span>';
      b.onclick = () => navigate(cur, u, true);
      $('#dial').appendChild(b);
    });
  }

  function openPanel(kind) {
    if (panel === kind) { closePanel(); return }
    panel = kind;
    $('#side').classList.add('open');
    $('#stitle').textContent = kind === 'h' ? 'History' : 'Bookmarks';
    const list = $('#list');
    const items = kind === 'h' ? history : marks;
    list.innerHTML = items.length ? '' : '<p style="padding:12px;color:var(--mute)">' + (kind === 'h' ? 'Pages you visit will show up here.' : 'Nothing saved yet.') + '</p>';
    items.forEach(it => {
      const b = document.createElement('button');
      b.innerHTML = esc(it.t || host(it.u)) + '<small>' + esc(it.u) + '</small>';
      b.onclick = () => navigate(cur, it.u, true);
      list.appendChild(b);
    });
  }
  function closePanel() { panel = null; $('#side').classList.remove('open') }

  function submitAddr(v) { navigate(cur, v, true) }

  $('#addr').addEventListener('keydown', e => { if (e.key === 'Enter') { submitAddr(e.target.value); e.target.blur() } });
  $('#addr').addEventListener('focus', e => e.target.select());
  $('#hform').addEventListener('submit', e => { e.preventDefault(); submitAddr($('#hq').value); $('#hq').value = '' });
  $('#add').onclick = () => newTab();
  $('#back').onclick = () => { if (cur.i > 0) { cur.i--; show(cur) } };
  $('#fwd').onclick = () => { if (cur.i < cur.stack.length - 1) { cur.i++; show(cur) } };
  $('#reload').onclick = () => { if (cur.frame) { setLoading(true); cur.frame.src = cur.stack[cur.i] } };
  $('#home').onclick = () => goHome(cur);
  $('#ext').onclick = $('#hext').onclick = () => { const u = cur.stack[cur.i]; if (u && u !== 'about:home') window.open(u, '_blank', 'noopener') };
  $('#star').onclick = () => {
    const u = cur.stack[cur.i];
    if (u === 'about:home') return;
    const i = marks.findIndex(m => m.u === u);
    if (i >= 0) marks.splice(i, 1); else marks.push({ t: cur.title, u });
    store.set('marks', marks); renderMarks(); activate(cur);
    if (panel === 'b') { panel = null; openPanel('b') }
  };
  $('#hist').onclick = () => openPanel('h');
  $('#bm').onclick = () => openPanel('b');
  $('#sx').onclick = closePanel;
  $('#clr').onclick = () => {
    if (panel === 'h') { history = []; store.set('history', history) }
    else { marks = []; store.set('marks', marks); renderMarks(); activate(cur) }
    const k = panel; panel = null; openPanel(k);
  };

  const sel = $('#eng');
  Object.entries(ENGINES).forEach(([k, e]) => { const o = document.createElement('option'); o.value = k; o.textContent = e.n + (e.embed ? '' : ' (new tab)'); sel.appendChild(o) });
  sel.value = engine;
  sel.onchange = () => { engine = sel.value; store.set('engine', engine) };

  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 't') { e.preventDefault(); newTab() }
    else if (k === 'w') { e.preventDefault(); closeTab(cur) }
    else if (k === 'l') { e.preventDefault(); $('#addr').focus() }
    else if (k === 'r') { e.preventDefault(); $('#reload').click() }
    else if (k === 'd') { e.preventDefault(); $('#star').click() }
  });

  renderMarks(); renderDial(); newTab();
})();
