/*
 * Moby-Dick: Beyond the Surface of the Sea — shared page logic.
 * Language-agnostic: every visible string comes from the page itself
 * (markup, or the JSON block with id="page-data").
 */
(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let DATA = {};
    try {
        DATA = JSON.parse($('#page-data').textContent);
    } catch (e) {
        console.error('Could not read page data', e);
    }
    const STR = (DATA.ai && DATA.ai.strings) || {};
    const fmt = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
    const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Safe storage (can throw in private mode or with blocked site data)
    const store = {
        get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return null; } },
        set(k, v, persist) {
            try {
                (persist ? localStorage : sessionStorage).setItem(k, v);
                (persist ? sessionStorage : localStorage).removeItem(k);
            } catch (e) { /* ignore */ }
        },
        remove(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
    };

    // --- Navigation: mobile menu -------------------------------------------
    const menuBtn = $('#mobile-menu-btn');
    const menu = $('#mobile-menu');
    if (menuBtn && menu) {
        const setMenu = (open) => {
            menu.classList.toggle('hidden', !open);
            menuBtn.setAttribute('aria-expanded', String(open));
        };
        menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
        $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    }

    // --- Language switch keeps your place (sections share ids across languages)
    $$('a[hreflang]').forEach((a) => a.addEventListener('click', () => {
        if (location.hash) a.href = a.href.split('#')[0] + location.hash;
    }));

    // --- Reading progress, back-to-top, scroll-spy -------------------------
    const progress = $('#progress-bar');
    const toTop = $('#to-top');
    const navLinks = $$('nav .nav-link');
    const spyTargets = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);

    let ticking = false;
    const onScroll = () => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        const ratio = max > 0 ? doc.scrollTop / max : 0;
        if (progress) progress.style.transform = `scaleX(${ratio})`;
        if (toTop) {
            const show = doc.scrollTop > 800;
            toTop.classList.toggle('opacity-0', !show);
            toTop.classList.toggle('pointer-events-none', !show);
        }
        let current = null;
        spyTargets.forEach((sec) => {
            if (sec.getBoundingClientRect().top <= 120) current = sec.id;
        });
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${current}`));
        ticking = false;
    };
    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
    if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }));

    // --- Scroll reveal -----------------------------------------------------
    if ('IntersectionObserver' in window && !prefersReducedMotion) {
        const targets = $$('main > section, .char-card, .symbol-card, .gam-card');
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.06 });
        targets.forEach((el) => {
            // Don't hide what is already on screen (e.g. after a reload mid-page)
            if (el.getBoundingClientRect().top < window.innerHeight) return;
            el.classList.add('reveal');
            io.observe(el);
        });
    }

    // --- Tabs (the whale) --------------------------------------------------
    $$('[data-tabs]').forEach((root) => {
        const tabs = $$('[role="tab"]', root);
        const select = (tab, focus) => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute('aria-controls'));
                if (panel) panel.hidden = !on;
            });
            if (focus) tab.focus();
        };
        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => select(tab, false));
            tab.addEventListener('keydown', (e) => {
                const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
                if (e.key in keys) {
                    e.preventDefault();
                    select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
                } else if (e.key === 'Home') {
                    e.preventDefault(); select(tabs[0], true);
                } else if (e.key === 'End') {
                    e.preventDefault(); select(tabs[tabs.length - 1], true);
                }
            });
        });
    });

    // --- The doubloon ------------------------------------------------------
    $$('[data-doubloon]').forEach((root) => {
        const coin = $('.doubloon', root);
        const btns = $$('[data-reader]', root);
        const readings = $$('[data-reading]', root);
        btns.forEach((btn) => btn.addEventListener('click', () => {
            const who = btn.dataset.reader;
            btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            readings.forEach((r) => { r.hidden = r.dataset.reading !== who; });
            if (coin && !prefersReducedMotion) {
                coin.classList.toggle('is-flipping');
            }
        }));
    });

    // --- Quotes: tap to copy -----------------------------------------------
    $$('#quotes figure').forEach((fig) => {
        fig.classList.add('cursor-pointer');
        fig.setAttribute('tabindex', '0');
        const copy = async () => {
            const q = $('blockquote', fig).textContent.trim();
            const who = $('figcaption', fig).textContent.trim();
            try {
                await navigator.clipboard.writeText(`${q} — ${who}`);
                fig.classList.add('ring-2', 'ring-crimson');
                setTimeout(() => fig.classList.remove('ring-2', 'ring-crimson'), 700);
            } catch (e) { /* clipboard unavailable */ }
        };
        fig.addEventListener('click', copy);
        fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
    });

    // --- Charts ------------------------------------------------------------
    function initCharts() {
        if (typeof window.Chart === 'undefined') return;
        const Chart = window.Chart;
        const font = { family: "'Lora', serif" };
        const isNarrow = () => window.innerWidth < 768;

        // Radar: the crew
        const radarCanvas = $('#characterRadarChart');
        if (radarCanvas && DATA.radar) {
            new Chart(radarCanvas, {
                type: 'radar',
                data: {
                    labels: DATA.radar.labels,
                    datasets: DATA.radar.datasets.map((d) => ({
                        label: d.label,
                        data: d.data,
                        hidden: !!d.hidden,
                        backgroundColor: `rgba(${d.color}, 0.18)`,
                        borderColor: `rgba(${d.color}, 1)`,
                        pointBackgroundColor: `rgba(${d.color}, 1)`,
                        borderWidth: 2,
                    })),
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { font: { ...font, size: 14 } } } },
                    scales: {
                        r: {
                            min: 0, max: 10,
                            angleLines: { color: 'rgba(0,0,0,0.1)' },
                            grid: { color: 'rgba(0,0,0,0.1)' },
                            pointLabels: { font: { ...font, size: isNarrow() ? 10 : 12 }, color: '#2c3e50' },
                            ticks: { display: false, stepSize: 2 },
                        },
                    },
                },
            });
        }

        // Doughnut: themes
        const themeRoot = $('[data-themes]');
        const doughnutCanvas = $('#themeDoughnutChart');
        if (!doughnutCanvas || !DATA.themes || !themeRoot) return;

        const themeBtns = $$('[data-theme-index]', themeRoot);
        const panels = $$('[data-theme-panel]', themeRoot);
        let shown = null;
        const showTheme = (index) => {
            if (index === shown) return;
            shown = index;
            panels.forEach((p) => { p.hidden = p.dataset.themePanel !== String(index); });
            themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeIndex === String(index))));
        };

        const chart = new Chart(doughnutCanvas, {
            type: 'doughnut',
            data: {
                labels: DATA.themes.labels,
                datasets: [{
                    data: DATA.themes.weights,
                    backgroundColor: ['#e3dac9', '#c0392b', '#c9a227', '#94a3b8', '#5f9ea0', '#a8a29e'],
                    borderColor: '#1a365d',
                    borderWidth: 2,
                    hoverOffset: 12,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '58%',
                plugins: {
                    legend: {
                        position: isNarrow() ? 'bottom' : 'right',
                        labels: { color: '#f4f1ea', font, boxWidth: 14 },
                    },
                    tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}` } },
                },
                onHover: (evt, els) => { if (els.length) showTheme(els[0].index); },
                onClick: (evt, els) => { if (els.length) showTheme(els[0].index); },
            },
        });

        themeBtns.forEach((btn) => btn.addEventListener('click', () => {
            const i = Number(btn.dataset.themeIndex);
            showTheme(i);
            chart.setActiveElements([{ datasetIndex: 0, index: i }]);
            chart.tooltip.setActiveElements([{ datasetIndex: 0, index: i }], { x: 0, y: 0 });
            chart.update();
        }));

        let lastNarrow = isNarrow();
        window.addEventListener('resize', () => {
            if (isNarrow() === lastNarrow) return;
            lastNarrow = isNarrow();
            chart.options.plugins.legend.position = lastNarrow ? 'bottom' : 'right';
            chart.update();
        });
    }
    if (document.readyState === 'complete') initCharts();
    else window.addEventListener('load', initCharts);

    // --- AI: settings (bring your own key) ---------------------------------
    const PROVIDERS = {
        anthropic: { label: 'Claude', defaultModel: 'claude-opus-5' },
        deepseek: { label: 'DeepSeek', defaultModel: 'deepseek-v4-flash' },
    };
    const KEYS = { provider: 'ahab.ai.provider', model: 'ahab.ai.model', key: 'ahab.ai.key' };

    const getSettings = () => {
        const provider = PROVIDERS[store.get(KEYS.provider)] ? store.get(KEYS.provider) : 'anthropic';
        return {
            provider,
            model: store.get(KEYS.model) || PROVIDERS[provider].defaultModel,
            key: store.get(KEYS.key) || '',
        };
    };

    const refreshStatus = () => {
        const s = getSettings();
        $$('[data-ai-status]').forEach((el) => {
            el.textContent = s.key ? fmt(STR.statusOn, { p: PROVIDERS[s.provider].label }) : STR.statusOff;
        });
    };

    const dialog = $('#ai-settings');
    if (dialog) {
        const providerSel = $('#ai-provider', dialog);
        const modelInput = $('#ai-model', dialog);
        const keyInput = $('#ai-key', dialog);
        const rememberBox = $('#ai-remember', dialog);

        const open = () => {
            const s = getSettings();
            providerSel.value = s.provider;
            modelInput.value = s.model;
            keyInput.value = s.key;
            let remembered = false;
            try { remembered = !!localStorage.getItem(KEYS.key); } catch (e) { /* ignore */ }
            rememberBox.checked = remembered;
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        };
        providerSel.addEventListener('change', () => { modelInput.value = PROVIDERS[providerSel.value].defaultModel; });
        $$('.ai-settings-btn').forEach((b) => b.addEventListener('click', open));

        $('#ai-forget', dialog).addEventListener('click', () => {
            store.remove(KEYS.key);
            keyInput.value = '';
            refreshStatus();
        });
        dialog.addEventListener('close', () => {
            if (dialog.returnValue !== 'save') return;
            const persist = rememberBox.checked;
            store.set(KEYS.provider, providerSel.value, persist);
            store.set(KEYS.model, modelInput.value.trim() || PROVIDERS[providerSel.value].defaultModel, persist);
            const key = keyInput.value.trim();
            if (key) store.set(KEYS.key, key, persist);
            else store.remove(KEYS.key);
            refreshStatus();
        });
    }
    refreshStatus();

    // --- AI: calls ---------------------------------------------------------
    class AIError extends Error {
        constructor(message, retryable) { super(message); this.retryable = retryable; }
    }

    async function callAnthropic(s, system, prompt) {
        const body = {
            model: s.model,
            max_tokens: 16000,
            system,
            messages: [{ role: 'user', content: prompt }],
        };
        const headers = {
            'content-type': 'application/json',
            'x-api-key': s.key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        };
        // Newer models: quick answers are enough, and declined requests fall back server-side.
        if (/^claude-(opus-5|sonnet-5|fable-5)/.test(s.model)) body.output_config = { effort: 'low' };
        if (/^claude-(opus-5|fable-5)/.test(s.model)) {
            body.fallbacks = 'default';
            headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
        }
        const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new AIError(`HTTP ${res.status}`, res.status === 429 || res.status >= 500);
        const data = await res.json();
        if (data.stop_reason === 'refusal') return { refusal: true };
        const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n\n');
        return { text };
    }

    async function callDeepSeek(s, system, prompt) {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.key}` },
            body: JSON.stringify({
                model: s.model,
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            }),
        });
        if (!res.ok) throw new AIError(`HTTP ${res.status}`, res.status === 429 || res.status >= 500);
        const data = await res.json();
        return { text: data.choices?.[0]?.message?.content || '' };
    }

    async function generate(system, prompt) {
        const s = getSettings();
        const call = s.provider === 'deepseek' ? callDeepSeek : callAnthropic;
        let delay = 1000;
        for (let attempt = 0; ; attempt++) {
            try {
                return await call(s, system, prompt);
            } catch (err) {
                const retryable = err instanceof AIError ? err.retryable : true; // network errors are retryable
                if (!retryable || attempt >= 2) throw err;
                await new Promise((r) => setTimeout(r, delay));
                delay *= 2;
            }
        }
    }

    // Minimal, safe markdown: escape everything first, then bold/italic/paragraphs.
    const formatMarkdown = (text) => escapeHtml(text)
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join('');

    const setBusy = (btn, busy) => {
        btn.disabled = busy;
        const sp = $('[data-spinner]', btn);
        if (sp) sp.classList.toggle('hidden', !busy);
    };

    const renderResult = async (target, system, prompt) => {
        try {
            const r = await generate(system, prompt);
            if (r.refusal) target.innerHTML = `<p>${escapeHtml(STR.refusal)}</p>`;
            else target.innerHTML = formatMarkdown(r.text || STR.empty);
        } catch (err) {
            console.error('AI request failed:', err);
            target.innerHTML = `<p>${escapeHtml(fmt(STR.error, { e: err.message || 'network' }))}</p>`;
        }
    };

    // --- The oracle --------------------------------------------------------
    const oracleForm = $('#oracle-form');
    if (oracleForm) {
        const input = $('#ai-input');
        const btn = $('#ai-submit');
        const container = $('#ai-response-container');
        const out = $('#ai-response-content');

        $$('.preset-btn').forEach((b) => b.addEventListener('click', () => {
            input.value = b.dataset.prompt;
            input.focus();
        }));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) oracleForm.requestSubmit();
        });

        // Without a key: suggest the sections of this guide that best match the question.
        const STOP = new Set(['what', 'which', 'why', 'does', 'that', 'this', 'with', 'from', 'about', 'have', 'moby', 'dick', 'the', 'and', 'chapter',
            'cosa', 'perché', 'come', 'della', 'delle', 'nella', 'questo', 'quale', 'sono', 'capitolo']);
        const suggestSections = (q) => {
            const words = (q.toLowerCase().match(/\p{L}{4,}/gu) || []).filter((w) => !STOP.has(w));
            if (!words.length) return [];
            return $$('main > section[id]')
                .filter((sec) => !['oracle', 'workshop'].includes(sec.id))
                .map((sec) => {
                    const text = sec.textContent.toLowerCase();
                    const score = words.reduce((n, w) => n + text.split(w.slice(0, Math.max(4, w.length - 2))).length - 1, 0);
                    return { sec, score };
                })
                .filter((x) => x.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((x) => x.sec);
        };

        oracleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (!q) return;
            container.hidden = false;

            if (!getSettings().key) {
                const secs = suggestSections(q);
                const links = secs.map((sec) => `<li><a class="underline text-ocean font-bold" href="#${sec.id}">${escapeHtml($('h2', sec).textContent.trim())}</a></li>`).join('');
                out.innerHTML = secs.length
                    ? `<p>${escapeHtml(STR.noKeyOracle)}</p><ul class="list-disc pl-6 mt-3 space-y-1">${links}</ul>`
                    : `<p>${escapeHtml(STR.noKeyNoMatch)} <a class="underline text-ocean font-bold" href="#whale">&rarr;</a></p>`;
                return;
            }

            setBusy(btn, true);
            input.disabled = true;
            out.innerHTML = `<p class="animate-pulse text-stone-500 italic">${escapeHtml(STR.thinkingOracle)}</p>`;
            await renderResult(out, DATA.ai.oracleSystem, q);
            input.disabled = false;
            setBusy(btn, false);
        });
    }

    // --- The workshop ------------------------------------------------------
    const offlineCompose = (voice, userText) => {
        const t = DATA.offline && DATA.offline[voice];
        if (!t) return '';
        const x = `&ldquo;<em>${escapeHtml(userText.replace(/[.!?…]+$/, ''))}</em>&rdquo;`;
        const parts = voice === 'ahab'
            ? [pick(t.openers), pick(t.middles), pick(t.closers)]
            : [pick(t.openers), pick(t.turns), pick(t.closers)];
        // Templates are trusted page content; only the user's words are escaped.
        return parts.map((p) => `<p>${p.replace('{x}', x)}</p>`).join('') +
            `<p class="text-xs not-italic opacity-60 mt-4">${escapeHtml(STR.offlineNote)}</p>`;
    };

    $$('.workshop-form').forEach((form) => {
        const voice = form.dataset.voice;
        const input = $('input[type="text"]', form);
        const btn = $('button[type="submit"]', form);
        const wrap = $('[data-output]', form);
        const out = $('[data-output-text]', form);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            wrap.hidden = false;

            if (!getSettings().key) {
                out.innerHTML = offlineCompose(voice, text);
                return;
            }

            setBusy(btn, true);
            input.disabled = true;
            const thinking = voice === 'ahab' ? STR.thinkingAhab : STR.thinkingIshmael;
            out.innerHTML = `<p class="animate-pulse">${escapeHtml(thinking)}</p>`;
            const system = voice === 'ahab' ? DATA.ai.ahabSystem : DATA.ai.ishmaelSystem;
            const wrapTpl = voice === 'ahab' ? DATA.ai.ahabWrap : DATA.ai.ishmaelWrap;
            await renderResult(out, system, fmt(wrapTpl, { x: text }));
            input.disabled = false;
            setBusy(btn, false);
        });
    });
})();
