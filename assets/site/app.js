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
  function track(name, extra) { var e = { event: name }; for (var k in (extra || {})) e[k] = extra[k]; window.dataLayer.push(e); if (window.gtag) window.gtag('event', name, extra || {}); }
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
  /* ---------- Hero stats count up ---------- */
  (function () {
    if (reduced) return;
    $$('.hero__stats [data-count]').forEach(function (el, k) {
      var to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = null;
      el.textContent = '0' + suf;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = clamp((t - t0) / 1400, 0, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e) + suf;
        if (p < 1) requestAnimationFrame(step);
      }
      setTimeout(function () { requestAnimationFrame(step); }, 1100 + k * 100);
    });
  })();

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
      [['out', "Hi, my B1/B2 appointment is in February and that's way too late yaar \uD83D\uDE13", '9:41'],
       ['in', "Hi! No worries \uD83D\uDE42 Share your travel date and we'll keep watching the slots 24/7", '9:42'],
       ['out', "I fly on 15 Jan, my cousin's wedding is there", '9:42'],
       ['in', "Got it \uD83D\uDC4D As soon as a suitable slot shows up, we'll message you right away. We can't promise a date, but we'll try our best", '9:43'],
       ['out', 'ok thanks, thik hai \uD83D\uDE4F', '9:43'],
       ['in', 'Welcome! Just fill the form with your name and number, our team will call you', '9:44']],
      [['out', 'How much will it cost? Any hidden charges?', '11:05'],
       ['in', 'We tell you our charges clearly on the call itself, no surprises \uD83D\uDE0A', '11:06'],
       ['out', 'and the US govt visa fee?', '11:06'],
       ['in', "That's separate, it is paid directly to the govt. We don't control it", '11:07'],
       ['out', 'ok. Will you book both OFC and interview?', '11:07'],
       ['in', 'Yes, whenever slots are open we help with both bookings, through the official system only \u2705', '11:08'],
       ['out', 'Great, please call me once', '11:08']],
      [['in', 'Good morning! \uD83C\uDF1E We found a slot for you. Want us to book it?', '8:12'],
       ['out', 'Really?? yes yes please book it asap', '8:13'],
       ['in', "Done \u2705 Please check your email for the confirmation. We're also sending the OFC day document list", '8:15'],
       ['out', 'got the mail! thank u so much \uD83D\uDE0A', '8:16'],
       ['in', "We'll send the interview guide too. All the best! \uD83D\uDE4C", '8:16']]
    ];
    var NAMES = ['Durga Prasad', 'Annie', 'Rahul'], nameEl = $('#waName'), avEl = $('#waAv');
    var cur = -1, timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function add(kind, text, time) {
      // the phone is on our side: our team's messages go out (green, right), the customer's come in (white, left)
      var d = document.createElement('div'); d.className = 'wa__msg wa__msg--' + (kind === 'in' ? 'out' : 'in');
      d.appendChild(document.createTextNode(text));
      var sm = document.createElement('small'); sm.textContent = time; d.appendChild(sm);
      body.appendChild(d);
    }
    function play(i) {
      if (i === cur) return;
      cur = i; timers.forEach(clearTimeout); timers = []; body.innerHTML = '';
      nameEl.textContent = NAMES[i]; avEl.textContent = NAMES[i].charAt(0);
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
    var noService = !fd.get('service');
    $('.hq', ef).classList.toggle('is-missing', noService);
    if (bad) { bad.focus(); return; }
    if (noService) { efErr.textContent = 'Please choose a service.'; return; }
    if (fd.get('website')) { ef.classList.add('is-done'); return; }   // honeypot: bots fill the hidden field
    var btn = $('button[type="submit"]', ef);
    setLoading(btn, true);
    post({
      _subject: 'Call request — ' + fd.get('name'),
      _template: 'table', _captcha: 'false',
      Name: fd.get('name'), Email: fd.get('email'), Phone: fd.get('phone'),
      Service: fd.get('service'),
      'Rough travel period': fd.get('travel') || '-',
      Source: 'Hero request-a-call form'
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
