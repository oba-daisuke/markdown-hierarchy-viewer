'use strict';

// ── Sidebar tab switching ─────────────────────────────────────────────────────
function switchTab(name) {
  const tabs = ['files', 'toc'];
  tabs.forEach(t => {
    const btn = document.getElementById('tab-' + t);
    const panel = document.getElementById('panel-' + t);
    if (!btn || !panel) return;
    const on = t === name;
    btn.classList.toggle('active', on);
    panel.classList.toggle('hidden', !on);
  });
}

// ── SubTree expand/collapse ───────────────────────────────────────────────────
function toggleSub(btn) {
  const row = btn.closest('.sub-dir-row, .sub-file-row');
  if (!row) return;
  const parent = row.parentElement;
  const expanded = btn.dataset.expanded === 'true';
  btn.dataset.expanded = expanded ? 'false' : 'true';
  btn.textContent = expanded ? '▸' : '▾';

  // For dirs: toggle .sub-children; for files: toggle .sub-headings
  const target = parent.querySelector('.sub-children, .sub-headings');
  if (target) target.classList.toggle('hidden', expanded);
}

// ── TOC scroll-spy ────────────────────────────────────────────────────────────
(function setupScrollSpy() {
  const main = document.getElementById('main-scroll');
  const prose = document.getElementById('prose');
  if (!main || !prose) return;

  const headingEls = prose.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]');
  if (headingEls.length === 0) return;

  const tocLinks = document.querySelectorAll('.toc-link[data-id]');
  function setActive(id) {
    tocLinks.forEach(a => {
      a.classList.toggle('active', a.dataset.id === id);
    });
  }

  const obs = new IntersectionObserver(entries => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length > 0) setActive(visible[0].target.id);
  }, { root: main, rootMargin: '-10% 0px -75% 0px' });

  headingEls.forEach(el => obs.observe(el));
})();

// ── TOC link: scroll to heading ───────────────────────────────────────────────
document.querySelectorAll('.toc-link[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    const main = document.getElementById('main-scroll');
    if (el && main) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Init: auto-show correct sidebar tab ───────────────────────────────────────
(function initTab() {
  const hasTree = !!document.getElementById('tab-files');
  // If directory was loaded, default to files tab; otherwise toc
  // (handled server-side via class; nothing needed here)
})();
