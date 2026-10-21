SPRINT OVERSEAS — WEBSITE UPLOAD GUIDE (sprintoverseas.com)
============================================================
1. Hostinger hPanel -> Files -> File Manager -> public_html
2. DELETE old site files (index.html, _next/, assets/, 404.html, .htaccess)
3. Upload sprint-overseas-final.zip -> right-click -> Extract
4. Enable SSL: hPanel -> Security -> SSL -> Install + Force HTTPS
5. Contact form: submit once to activate FormSubmit (arrives at springoverseas22@gmail.com)
6. After any edit: press Ctrl+Shift+R (hard refresh) to bypass browser cache

Contents: index.html (homepage), 404.html, .htaccess, robots.txt,
assets/ (images, logo), assets/site/ (site.css, app.js, scene.js — the 3D page),
assets/vendor/ (three.js, GSAP, Lenis — served locally), assets/3d/ (globe map),
_next/ (still used by 404.html only).
After editing site.css / app.js / scene.js, bump the ?v= number on their
<link>/<script> tags in index.html so visitors get the new version.
