/* ==========================================================================
   SPRINT OVERSEAS — interaction layer (no dependencies)
   Reveals, nav, eligibility sheet, lead form.
   Everything is progressive: the page is complete without this file.
   ========================================================================== */
(function () {
  'use strict';

  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/suma@sprintoverseas.com';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- Conversion events for Google Tag Manager / Google Ads / Meta Pixel ---------- */
  window.dataLayer = window.dataLayer || [];
  function track(name, extra) { var e = { event: name }; for (var k in (extra || {})) e[k] = extra[k]; window.dataLayer.push(e); }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h.indexOf('tel:') === 0) track('click_call');
    else if (h.indexOf('wa.me') > -1) track('click_whatsapp');
  });

  /* ---------- Intro + reveals ---------- */
  // the inline head script drops the hidden-until-revealed state if this file never runs
  window.SO_READY = true;
  setTimeout(function () {
    document.body.classList.add('is-ready');
    $$('.hero .rv').forEach(function (el, i) { el.style.transitionDelay = (60 + i * 70) + 'ms'; el.classList.add('is-in'); });
  }, 40);

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target, sibs = $$(':scope > .rv', el.parentElement);
      el.style.transitionDelay = Math.min(sibs.indexOf(el), 5) * 70 + 'ms';
      el.classList.add('is-in');
      revealIO.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  $$('.rv').forEach(function (el) { if (!el.closest('.hero')) revealIO.observe(el); });

  /* ---------- Nav, menu, floating actions ---------- */
  var nav = $('#nav'), fab = $('.fab'), heroEl = $('#home');
  var navLinks = $$('[data-nav]');
  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
    fab.classList.toggle('is-on', heroEl.getBoundingClientRect().bottom < 0);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sectionIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      navLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['home', 'about', 'how-it-works', 'contact'].forEach(function (id) { sectionIO.observe(document.getElementById(id)); });

  var burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); } });

  /* ---------- Eligibility form: inline on desktop, bottom sheet on phones (up to 767px) ---------- */
  var wrap = $('#eligibility'), card = $('#elig-form'), closeBtn = $('#sheet-close');
  var sheetMQ = window.matchMedia('(max-width: 767px)'), lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement;
    wrap.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    closeBtn.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!wrap.classList.contains('is-open')) return;
    wrap.classList.remove('is-open');
    document.body.style.overflow = '';
    card.removeAttribute('role');
    card.removeAttribute('aria-modal');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  closeBtn.addEventListener('click', closeSheet);
  wrap.addEventListener('click', function (e) { if (e.target === wrap) closeSheet(); });
  sheetMQ.addEventListener('change', function () { if (!sheetMQ.matches) closeSheet(); });
  document.addEventListener('keydown', function (e) {
    if (!wrap.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key !== 'Tab') return;
    var f = $$('button:not([disabled]), input:not([disabled])', card).filter(function (x) { return x.offsetParent !== null || x === document.activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $$('a[href="#eligibility"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (sheetMQ.matches) { e.preventDefault(); openSheet(); return; }
      setTimeout(function () { $('#elig-form input[name="name"]').focus({ preventScroll: true }); }, 700);
    });
  });
  /* ---------- Slot watch: the next three months, real dates, random "open" days ---------- */
  function initSlotWatch(box, numbers) {
    if (!box) return;
    var host = $('.lcal__months', box), state = $('.lcal__state', box);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = new Date(today.getFullYear(), today.getMonth() + 3, 0);   // last day of the third month
    var cells = [], valid = [];
    for (var m = 0; m < 3; m++) {
      var first = new Date(today.getFullYear(), today.getMonth() + m, 1);
      var wrap = document.createElement('div'); wrap.className = 'lcal__m';
      var h = document.createElement('h4'); h.textContent = first.toLocaleDateString('en-IN', { month: numbers ? 'long' : 'short', year: numbers ? 'numeric' : '2-digit' });
      wrap.appendChild(h);
      if (numbers) {
        var w = document.createElement('div'); w.className = 'lcal__w';
        'MTWTFSS'.split('').forEach(function (ch) { var sp = document.createElement('span'); sp.textContent = ch; w.appendChild(sp); });
        wrap.appendChild(w);
      }
      var g = document.createElement('div'); g.className = 'lcal__g';
      var pad = (first.getDay() + 6) % 7;                  // weeks start on Monday
      for (var p0 = 0; p0 < pad; p0++) { var padEl = document.createElement('i'); padEl.className = 'pad'; g.appendChild(padEl); }
      var dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      for (var d = 1; d <= dim; d++) {
        var date = new Date(first.getFullYear(), first.getMonth(), d), el = document.createElement('i');
        var future = date > today, inRange = future && date <= end;
        if (numbers) el.textContent = d;
        if (!inRange) el.className = 'off';
        if (date.getTime() === today.getTime()) el.className = 'off today';
        g.appendChild(el);
        if (inRange) { var rec = { el: el, date: date }; cells.push(rec); if (date.getDay() >= 1 && date.getDay() <= 5) valid.push(rec); }
      }
      wrap.appendChild(g); host.appendChild(wrap);
    }
    var visible = true, timers = [];
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(box);
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function reset() { cells.forEach(function (c) { c.el.classList.remove('scan', 'hit'); }); state.classList.remove('found'); state.textContent = '\u25CF Scanning'; }
    function pick() {
      var pool = valid.slice(), out = [], n = 4 + Math.floor(Math.random() * 3);
      while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      return out.sort(function (a, b) { return a.date - b.date; });
    }
    function show(hits) {
      hits.forEach(function (c) { c.el.classList.add('hit'); });
      state.classList.add('found');
      state.textContent = '\u25CF Slot found: ' + hits[0].date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    if (reduced) { show(pick()); return; }
    function cycle() {
      if (!visible || document.hidden) { later(cycle, 600); return; }
      reset();
      cells.forEach(function (c, i) {
        later(function () { c.el.classList.add('scan'); }, i * 24);
        later(function () { c.el.classList.remove('scan'); }, i * 24 + 150);
      });
      var found = cells.length * 24 + 250;
      later(function () { show(pick()); }, found);
      later(cycle, found + 3800);
    }
    cycle();
  }
  initSlotWatch($('#lcal'), false);
  initSlotWatch($('#swatch'), true);

  /* ---------- How it works: rail fills as you scroll, steps light up ---------- */
  (function () {
    var list = $('#howlist');
    if (!list) return;
    var steps = $$('.how__step', list), tick = false;
    function update() {
      tick = false;
      var vh = window.innerHeight, line = vh * .62, r = list.getBoundingClientRect();
      var first = steps[0].getBoundingClientRect(), last = steps[steps.length - 1].getBoundingClientRect();
      var y0 = first.top + 32, y1 = last.top + 32;
      var p = reduced ? 1 : clamp((line - y0) / (y1 - y0), 0, 1);
      list.style.setProperty('--p', p.toFixed(4));
      steps.forEach(function (s) { s.classList.toggle('is-on', reduced || s.getBoundingClientRect().top + 32 < line); });
    }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ---------- Sample WhatsApp chats on the phone: the chat changes as you scroll ---------- */
  (function () {
    var track = $('#chatsTrack'), body = $('#waBody'), dots = $$('#chatDots button');
    if (!track || !body) return;
    var CHATS = [
      [['out', 'Hello, mera B1/B2 ka appointment Feb me hai. Bohot late hai yaar \uD83D\uDE13', '9:41'],
       ['in', 'Hi! Koi tension nahi \uD83D\uDE42 Aap travel date bata dijiye, hum slots pe nazar rakhte hain 24/7', '9:42'],
       ['out', '15 Jan ko flight hai, cousin ki shaadi hai US me', '9:42'],
       ['in', 'Samajh gaye \uD83D\uDC4D Jaise hi koi suitable slot dikhega, aapko turant message karenge. Date ki guarantee nahi de sakte, but poori koshish rahegi', '9:43'],
       ['out', 'thik hai, thnx \uD83D\uDE4F', '9:43'],
       ['in', 'Welcome! Form me naam aur number daal dijiye, team call karegi', '9:44']],
      [['out', 'Sir charges kitne honge? koi hidden charges toh nai hai na?', '11:05'],
       ['in', 'Hamara charge hum pehle hi call pe clearly bata dete hain, koi surprise nahi \uD83D\uDE0A', '11:06'],
       ['out', 'aur US govt wali visa fee?', '11:06'],
       ['in', 'Wo alag hai, seedha govt ko pay hoti hai. Us pe hamara control nahi hota', '11:07'],
       ['out', 'ok. VAC aur interview dono book karoge?', '11:07'],
       ['in', 'Haan, jab slots available ho tab dono booking me help karte hain, official system se hi \u2705', '11:08'],
       ['out', 'Cool, call me plz', '11:08']],
      [['in', 'Good morning! \uD83C\uDF1E Aapke liye ek slot dikh raha hai. Book karna hai?', '8:12'],
       ['out', 'wow sach me?? haan haan please book kardo', '8:13'],
       ['in', 'Ho gaya \u2705 Confirmation mail check kijiye. VAC wale din ke documents ki list bhi bhej rahe hain', '8:15'],
       ['out', 'mail aa gaya! thank u so much \uD83D\uDE0A', '8:16'],
       ['in', 'Interview ke liye bhi guide bhej denge. All the best! \uD83D\uDE4C', '8:16']]
    ];
    var cur = -1, timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function add(kind, text, time) {
      var d = document.createElement('div'); d.className = 'wa__msg wa__msg--' + kind;
      d.appendChild(document.createTextNode(text));
      var sm = document.createElement('small'); sm.textContent = time; d.appendChild(sm);
      body.appendChild(d);
    }
    function play(i) {
      if (i === cur) return;
      cur = i; timers.forEach(clearTimeout); timers = []; body.innerHTML = '';
      dots.forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.setAttribute('aria-selected', String(k === i)); });
      var t = 250;
      CHATS[i].forEach(function (m) {
        add(m[0], m[1], m[2]); return;   // shown as a finished screen, like a screenshot
        if (m[0] === 'in') {
          later(function () { var ty = document.createElement('div'); ty.className = 'wa__typing'; ty.innerHTML = '<i></i><i></i><i></i>'; body.appendChild(ty); }, t);
          t += 1000;
          later(function () { var ty = body.querySelector('.wa__typing'); if (ty) ty.remove(); add(m[0], m[1], m[2]); }, t);
          t += 900;
        } else {
          later(function () { add(m[0], m[1], m[2]); }, t);
          t += 1100;
        }
      });
    }
    function onScroll() {
      var r = track.getBoundingClientRect(), span = r.height - window.innerHeight;
      var p = span > 0 ? clamp(-r.top / span, 0, .999) : 0;
      play(Math.floor(p * CHATS.length));
    }
    var tk = false;
    window.addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(function () { tk = false; onScroll(); }); } }, { passive: true });
    dots.forEach(function (b, k) {
      b.addEventListener('click', function () {
        var span = track.offsetHeight - window.innerHeight, top = track.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + span * ((k + .5) / CHATS.length), behavior: reduced ? 'auto' : 'smooth' });
      });
    });
    play(0);
  })();

  /* ---------- Pause decorative motion while it is off-screen ---------- */
  var pauseIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.target.classList.toggle('is-offscreen', !en.isIntersecting); });
  });
  pauseIO.observe($('.hero'));

  /* ---------- Forms ---------- */
  function markInvalid(form) {
    var bad = null;
    $$('input[required], select[required]', form).forEach(function (inp) {
      var ok = inp.checkValidity() && String(inp.value).trim() !== '';
      inp.closest('.fld, .hg').classList.toggle('is-invalid', !ok);
      inp.setAttribute('aria-invalid', String(!ok));
      if (!ok && !bad) bad = inp;
    });
    return bad;
  }
  function wireClear(form) {
    $$('input, select, textarea', form).forEach(function (inp) {
      var clear = function () {
        var f = inp.closest('.fld, .hg'); if (f) { f.classList.remove('is-invalid'); inp.removeAttribute('aria-invalid'); }
        var q = inp.closest('.hq'); if (q) q.classList.remove('is-missing');
      };
      inp.addEventListener('input', clear);
      inp.addEventListener('change', clear);
    });
  }
  function setLoading(btn, on) { btn.disabled = on; btn.classList.toggle('is-loading', on); }
  function post(payload) {
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  var ef = $('#elig-form'), efErr = $('#elig-err');
  wireClear(ef);
  ef.addEventListener('submit', function (e) {
    e.preventDefault();
    efErr.textContent = '';
    var bad = markInvalid(ef), fd = new FormData(ef);
    var missing = ['passport', 'fee', 'started'].filter(function (k) { return !fd.get(k); });
    $$('.hq', ef).forEach(function (q) { q.classList.toggle('is-missing', missing.indexOf($('input', q).name) > -1); });
    if (bad) { bad.focus(); return; }
    if (missing.length) { efErr.textContent = 'Please answer all 3 questions to check your eligibility.'; return; }
    var btn = $('button[type="submit"]', ef);
    setLoading(btn, true);
    post({
      _subject: 'Eligibility check — ' + fd.get('name'),
      _template: 'table', _captcha: 'false',
      Name: fd.get('name'), Phone: fd.get('phone'), Email: fd.get('email'),
      'Valid passport to travel to the USA?': fd.get('passport'),
      'Visa fee paid on US Govt website?': fd.get('fee'),
      'Have you started your visa process?': fd.get('started'),
      Source: 'Hero eligibility form'
    }).then(function (r) {
      if (!r.ok) throw new Error('send failed');
      ef.classList.add('is-done');
      ef.reset();
      track('generate_lead', { form_position: 'hero_eligibility' });
    }).catch(function () {
      efErr.textContent = 'Something went wrong — please try again or WhatsApp us at +91 95022 90703.';
    }).then(function () { setLoading(btn, false); });
  });

  var cf = $('#cform'), cfErr = $('#cform-err');
  wireClear(cf);
  cf.addEventListener('submit', function (e) {
    e.preventDefault();
    cfErr.textContent = '';
    var bad = markInvalid(cf);
    if (bad) { bad.focus(); return; }
    var fd = new FormData(cf), btn = $('button[type="submit"]', cf);
    setLoading(btn, true);
    post({
      _subject: 'Free consultation request — ' + fd.get('name'),
      _template: 'table', _captcha: 'false',
      Name: fd.get('name'), Email: fd.get('email'), Phone: fd.get('phone'),
      Message: fd.get('message'),
      Source: 'Contact form'
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok || String(res.j.success) !== 'true') {
        cfErr.textContent = res.j.message || 'Something went wrong. Please try again, or WhatsApp us directly.';
        return;
      }
      cf.classList.add('is-done');
      cf.reset();
      track('generate_lead', { form_position: 'contact' });
    }).catch(function () {
      cfErr.textContent = "Couldn't reach the server. Please WhatsApp us instead at +91 95022 90703 — we reply fast.";
    }).then(function () { setLoading(btn, false); });
  });
  $('#cform-again').addEventListener('click', function () { cf.classList.remove('is-done'); });
})();
