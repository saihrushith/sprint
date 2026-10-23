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
