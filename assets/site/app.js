/* ==========================================================================
   SPRINT OVERSEAS — interaction layer
   Smooth scroll, reveals, routes, process progress, lead forms.
   Shares state with the WebGL scene through window.SO.
   ========================================================================== */
(function () {
  'use strict';

  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/suma@sprintoverseas.com';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  var SO = window.SO = window.SO || {};
  SO.reduced = reduced;
  SO.route = 0;
  SO.processP = 0;
  SO.velocity = 0;
  SO.pointer = { x: 0, y: 0 };
  SO.frameHooks = SO.frameHooks || [];

  /* ---------- Loader ---------- */
  var loader = $('#loader'), bar = $('#loader-bar'), pct = $('#loader-pct');
  var shown = 0, target = 12, loaded = false, started = performance.now();
  SO.setLoad = function (v) { target = Math.max(target, v); };
  function loaderTick() {
    if (loaded) return;
    var elapsed = performance.now() - started;
    var t = Math.min(target, 96, 30 + elapsed / 40);
    shown += (t - shown) * .12;
    bar.style.width = shown.toFixed(1) + '%';
    pct.textContent = String(Math.round(shown)).padStart(3, '0');
    if ((target >= 100 && elapsed > 650) || elapsed > 4200) return finishLoad();
    requestAnimationFrame(loaderTick);
  }
  function finishLoad() {
    if (loaded) return;
    loaded = true;
    bar.style.width = '100%';
    pct.textContent = '100';
    setTimeout(function () {
      loader.classList.add('is-done');
      document.body.classList.add('is-loaded');
      $$('.hero .reveal-up').forEach(function (el, i) {
        setTimeout(function () { el.classList.add('is-in'); }, 420 + i * 110);
      });
    }, 220);
  }
  window.addEventListener('so:scene-ready', function () { SO.setLoad(100); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { SO.setLoad(60); });
  requestAnimationFrame(loaderTick);

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  var hasGsap = typeof window.gsap !== 'undefined';
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: .09, smoothWheel: true, wheelMultiplier: .95, touchMultiplier: 1.4 });
    SO.lenis = lenis;
    if (hasGsap) {
      lenis.on('scroll', function () { if (window.ScrollTrigger) ScrollTrigger.update(); });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
  }
  // one frame clock for everything that reads scroll (keeps WebGL glued to DOM)
  function frame() {
    SO.velocity = lenis ? lenis.velocity : 0;
    for (var i = 0; i < SO.frameHooks.length; i++) SO.frameHooks[i]();
  }
  if (hasGsap) gsap.ticker.add(frame);
  else (function raf() { frame(); requestAnimationFrame(raf); })();

  function navOffset() { return -(window.innerWidth < 761 ? 64 : 70) - 10; }
  function scrollToTarget(el) {
    if (!el) return;
    var off = el.id === 'eligibility' ? -90 : (el.id === 'home' ? 0 : navOffset());
    if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.6, easing: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + off, behavior: reduced ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(el);
    if (id === '#eligibility') setTimeout(function () { var f = $('#elig-form input[name="name"]'); f && f.focus({ preventScroll: true }); }, 1300);
  });

  /* ---------- Nav ---------- */
  var nav = $('#nav'), mbar = $('#mbar'), fab = $('.fab'), hero = $('#home'), elig = $('#eligibility');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    var past = elig.getBoundingClientRect().bottom < 0;
    var atContact = $('#contact').getBoundingClientRect().top < window.innerHeight * .6;
    mbar.classList.toggle('is-on', past && !atContact);
    fab.classList.toggle('is-on', past);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var navLinks = $$('[data-nav]');
  var sectionIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = '#' + en.target.id;
      navLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === id); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['home', 'about', 'services', 'process', 'contact'].forEach(function (id) { sectionIO.observe(document.getElementById(id)); });

  var burger = $('#burger'), menu = $('#menu');
  function closeMenu() {
    document.documentElement.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  }
  burger.addEventListener('click', function () {
    var open = !document.documentElement.classList.contains('menu-open');
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Split headings + reveals ---------- */
  $$('.split').forEach(function (h) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', i++);
            wi.textContent = part; w.appendChild(wi); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(h);
  });
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.split, .reveal-up').forEach(function (el) { if (!el.closest('.hero')) revealIO.observe(el); });

  /* ---------- Scroll-linked decoration ---------- */
  if (hasGsap && window.ScrollTrigger && !reduced) {
    gsap.to('.hero__bgword', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.fromTo('.cta__bgword', { xPercent: 8 }, { xPercent: -8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.foot__giant p', { yPercent: 40 }, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.fromTo('.ph--back', { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.ph--front', { yPercent: -4 }, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.ribbon__band--a', { rotate: -4 }, { rotate: -1, ease: 'none', scrollTrigger: { trigger: '.ribbon', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.ribbon__band--b', { rotate: 4 }, { rotate: 1.2, ease: 'none', scrollTrigger: { trigger: '.ribbon', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------- Services: routes ---------- */
  var routes = $$('.route');
  var scIx = $('#sc-ix'), scTag = $('#sc-tag'), scTitle = $('#sc-title'), scDots = $$('.frame__dots i');
  function openRoute(i, fromHover) {
    routes.forEach(function (r, k) {
      var on = k === i;
      r.classList.toggle('is-open', on);
      $('.route__btn', r).setAttribute('aria-expanded', String(on));
    });
    SO.route = i;
    var r = routes[i];
    scIx.textContent = '0' + (i + 1);
    scTag.textContent = $('.route__tag', r).textContent;
    scTitle.textContent = $('.route__t', r).textContent;
    scDots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    if (!fromHover && lenis) setTimeout(function () { lenis.resize(); }, 750);
  }
  routes.forEach(function (r, i) {
    var btn = $('.route__btn', r);
    btn.addEventListener('click', function () {
      var isOpen = r.classList.contains('is-open');
      if (isOpen && !finePointer) { r.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); return; }
      openRoute(i);
    });
    if (finePointer) r.addEventListener('mouseenter', function () { if (!r.classList.contains('is-open')) openRoute(i, true); });
  });
  $$('[data-route-pick]').forEach(function (a) {
    a.addEventListener('click', function () {
      var sel = $('#cform select[name="service"]');
      sel.value = a.getAttribute('data-route-pick');
      sel.closest('.fld').classList.remove('is-invalid');
    });
  });

  /* ---------- Process progress ---------- */
  var stage = $('.frame--process'), steps = $$('.step'), tabs = $$('#ptabs span'), rail = $('#prail'), psIx = $('#ps-ix'), psK = $('#ps-k');
  var lastStep = -1;
  SO.frameHooks.push(function () {
    var vh = window.innerHeight;
    var first = steps[0].getBoundingClientRect(), last = steps[steps.length - 1].getBoundingClientRect();
    var a = first.top + first.height / 2, b = last.top + last.height / 2, c = vh * (window.innerWidth < 1081 ? .68 : .5);
    var p = clamp((c - a) / (b - a), 0, 1) * (steps.length - 1);
    SO.processP = p;
    rail.style.transform = 'scaleX(' + (p / (steps.length - 1)).toFixed(4) + ')';
    var s = Math.round(p);
    if (window.innerWidth < 1081) {
      // steps scroll beneath the sticky stage on small screens: fade them out before they reach it
      var edge = stage.getBoundingClientRect().bottom;
      steps.forEach(function (el, k) {
        var top = el.firstElementChild.getBoundingClientRect().top;
        el.style.opacity = (clamp((top - edge + 10) / 60, 0, 1) * (k === s ? 1 : .4)).toFixed(3);
      });
    } else if (steps[0].style.opacity) steps.forEach(function (el) { el.style.opacity = ''; });
    if (s !== lastStep) {
      lastStep = s;
      steps.forEach(function (el, k) { el.classList.toggle('is-active', k === s); });
      tabs.forEach(function (el, k) { el.classList.toggle('on', k <= s); });
      psIx.textContent = '0' + (s + 1);
      psK.textContent = $('.mono', steps[s]).textContent;
    }
  });

  /* ---------- Pointer: magnetic, tilt, scene parallax ---------- */
  window.addEventListener('pointermove', function (e) {
    SO.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    SO.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
  if (finePointer && !reduced) {
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * .22, y = (e.clientY - r.top - r.height / 2) * .3;
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
    var vis = $('.about__visual');
    vis.addEventListener('pointermove', function (e) {
      var r = vis.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      $('.ph--back', vis).style.transform = 'rotateY(' + (-8 + x * 10) + 'deg) rotateX(' + (3 - y * 8) + 'deg)';
      $('.ph--front', vis).style.transform = 'rotateY(' + (6 + x * 12) + 'deg) rotateX(' + (-y * 10) + 'deg) translateZ(40px)';
    });
    vis.addEventListener('pointerleave', function () { $$('.ph', vis).forEach(function (p) { p.style.transform = ''; }); });
  }

  /* ---------- Forms ---------- */
  function markInvalid(form) {
    var bad = null;
    $$('input[required], select[required]', form).forEach(function (inp) {
      var ok = inp.checkValidity() && String(inp.value).trim() !== '';
      inp.closest('.fld').classList.toggle('is-invalid', !ok);
      if (!ok && !bad) bad = inp;
    });
    return bad;
  }
  function wireClear(form) {
    $$('input, select, textarea', form).forEach(function (inp) {
      inp.addEventListener('input', function () { var f = inp.closest('.fld'); f && f.classList.remove('is-invalid'); });
      inp.addEventListener('change', function () {
        var f = inp.closest('.fld'); f && f.classList.remove('is-invalid');
        var q = inp.closest('.q'); q && q.classList.remove('is-missing');
      });
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
    var bad = markInvalid(ef);
    var fd = new FormData(ef);
    var missing = ['passport', 'fee', 'started'].filter(function (k) { return !fd.get(k); });
    $$('.q', ef).forEach(function (q) {
      var name = $('input', q).name;
      q.classList.toggle('is-missing', missing.indexOf(name) > -1);
    });
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
    var fd = new FormData(cf);
    var btn = $('button[type="submit"]', cf);
    setLoading(btn, true);
    post({
      _subject: 'Free consultation request — ' + fd.get('name'),
      _template: 'table', _captcha: 'false',
      Name: fd.get('name'), Email: fd.get('email'), Phone: fd.get('phone'),
      'Visa route': fd.get('service'),
      'Travel plan': fd.get('message') || '—'
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok || String(res.j.success) !== 'true') {
        cfErr.textContent = res.j.message || 'Something went wrong. Please try again, or WhatsApp us directly.';
        return;
      }
      cf.classList.add('is-done');
      cf.reset();
    }).catch(function () {
      cfErr.textContent = "Couldn't reach the server. Please WhatsApp us instead at +91 95022 90703 — we reply fast.";
    }).then(function () { setLoading(btn, false); });
  });
  $('#cform-again').addEventListener('click', function () { cf.classList.remove('is-done'); });
})();
