/* Ads landing page: reveal, lead forms, conversion events. No dependencies. */
(function () {
  'use strict';
  var ENDPOINT = 'https://formsubmit.co/ajax/suma@sprintoverseas.com';
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Conversion hooks: push to dataLayer so Google Tag Manager / Google Ads / Meta Pixel
  // can listen for these events. Nothing is sent anywhere until a tag is added to the page.
  window.dataLayer = window.dataLayer || [];
  function track(name, extra) {
    var e = { event: name };
    for (var k in (extra || {})) e[k] = extra[k];
    window.dataLayer.push(e);
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h.indexOf('tel:') === 0) track('click_call');
    else if (h.indexOf('wa.me') > -1) track('click_whatsapp');
  });

  // scroll reveal
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('.rv').forEach(function (el) { io.observe(el); });
  } else {
    $$('.rv').forEach(function (el) { el.classList.add('is-in'); });
  }

  // smooth jump to the first form for every "get callback" button
  $$('a[href="#lead"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.getElementById('lead');
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      var f = t.querySelector('input'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 500);
    });
  });

  // lead forms (the page has two; both post to the same inbox)
  $$('.lform').forEach(function (form) {
    var err = form.querySelector('.form-err'), btn = form.querySelector('button[type="submit"]');
    $$('input, select', form).forEach(function (el) {
      el.addEventListener('input', function () { var f = el.closest('.fld'); if (f) f.classList.remove('is-invalid'); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var bad = null;
      $$('[required]', form).forEach(function (el) {
        var ok = el.checkValidity() && String(el.value).trim() !== '';
        el.closest('.fld').classList.toggle('is-invalid', !ok);
        if (!ok && !bad) bad = el;
      });
      if (bad) { bad.focus(); return; }
      var fd = new FormData(form);
      btn.disabled = true;
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'B1/B2 appointment lead — ' + fd.get('name'),
          _template: 'table', _captcha: 'false',
          Name: fd.get('name'), Phone: fd.get('phone'), Email: fd.get('email') || '—',
          'What they need': fd.get('need'), 'Preferred consulate': fd.get('city'),
          Source: 'Ads landing page (' + (form.getAttribute('data-pos') || 'form') + ')',
          Page: location.href
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('send failed');
        form.classList.add('is-done');
        form.reset();
        track('generate_lead', { form_position: form.getAttribute('data-pos') || 'form' });
      }).catch(function () {
        err.textContent = 'Sorry, that did not go through. Please WhatsApp us on +91 95022 90703 and we will help right away.';
      }).then(function () { btn.disabled = false; });
    });
  });
})();
