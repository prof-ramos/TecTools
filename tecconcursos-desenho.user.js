// ==UserScript==
// @name         TecConcursos - Desenho Livre sobre Questões
// @namespace    https://tecconcursos.com.br/
// @version      2.0
// @description  Permite desenhar à mão livre (grifar/riscar) sobre a questão. Anotações somem ao trocar de questão.
// @author       Você
// @match        https://www.tecconcursos.com.br/questoes/*
// @match        https://www.tecconcursos.com.br/questoes/cadernos/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ══════════════════════════════════════════════════════════
    //  CONFIGURAÇÕES  (edite aqui para personalizar)
    // ══════════════════════════════════════════════════════════
    const CFG = {
        strokeColor: 'rgba(220, 50, 50, 0.72)',  // cor do traço (rgba)
        lineWidth: 4,                            // espessura inicial (px)
        zIndex: 99998,                           // z-index do canvas
        // Seletores CSS — altere somente se o site mudar a estrutura
        selArticle: 'article.questao-enunciado',
        selIdInput: '.questao-rg-area-coluna-1 input[type="hidden"]',
    };

    // ══════════════════════════════════════════════════════════
    //  ESTADO INTERNO
    // ══════════════════════════════════════════════════════════
    let canvas = null;     // elemento <canvas>
    let ctx = null;        // contexto 2D
    let panel = null;      // painel flutuante
    let observer = null;   // MutationObserver
    let drawMode = false;  // modo desenho ativo?
    let isDrawing = false; // botão do mouse pressionado?
    let currentQId = null; // ID da questão atual
    let resizeTimer = null;

    // ══════════════════════════════════════════════════════════
    //  UTILITÁRIOS
    // ══════════════════════════════════════════════════════════
    const getArticle = () => document.querySelector(CFG.selArticle);
    const getQId = () => document.querySelector(CFG.selIdInput)?.value ?? null;

    /** Aplica o estilo de traço ao ctx (necessário após resize que limpa o canvas) */
    function applyCtxStyle() {
        if (!ctx) return;
        ctx.strokeStyle = CFG.strokeColor;
        ctx.lineWidth = parseInt(document.getElementById('tcc-slider')?.value ?? CFG.lineWidth);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    }

    /** Posiciona e redimensiona o canvas para cobrir o article */
    function positionCanvas() {
        const article = getArticle();
        if (!article || !canvas) return;
        const bcr = article.getBoundingClientRect();
        const w = Math.round(bcr.width);
        const h = Math.round(bcr.height);
        // Atualiza posição (position:fixed acompanha a viewport)
        canvas.style.top = bcr.top + 'px';
        canvas.style.left = bcr.left + 'px';
        // Só redimensiona se necessário (limpa o conteúdo, evitável p/ pequenas variações)
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            applyCtxStyle();   // ctx é resetado ao mudar width/height
        }
    }

    // ══════════════════════════════════════════════════════════
    //  CRIAÇÃO DO CANVAS
    // ══════════════════════════════════════════════════════════
    function createCanvas() {
        document.getElementById('tcc-draw-canvas')?.remove();
        const article = getArticle();
        if (!article) return;
        const bcr = article.getBoundingClientRect();
        canvas = document.createElement('canvas');
        canvas.id = 'tcc-draw-canvas';
        canvas.width = Math.round(bcr.width);
        canvas.height = Math.round(bcr.height);
        Object.assign(canvas.style, {
            position: 'fixed',
            top: bcr.top + 'px',
            left: bcr.left + 'px',
            width: Math.round(bcr.width) + 'px',
            height: Math.round(bcr.height) + 'px',
            zIndex: String(CFG.zIndex),
            pointerEvents: 'none',   // desligado por padrão
            cursor: 'crosshair',
            boxSizing: 'border-box',
        });
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        applyCtxStyle();
        // ── Eventos mouse ──────────────────────────────────────
        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseup', onUp);
        canvas.addEventListener('mouseleave', onUp);
        // ── Eventos touch ──────────────────────────────────────
        canvas.addEventListener('touchstart', onTouchDown, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onUp);
    }

    // ══════════════════════════════════════════════════════════
    //  CRIAÇÃO DO PAINEL FLUTUANTE
    // ══════════════════════════════════════════════════════════
    function createPanel() {
        document.getElementById('tcc-draw-panel')?.remove();
        panel = document.createElement('div');
        panel.id = 'tcc-draw-panel';
        GM_addStyle(`
            #tcc-draw-panel {
                position: fixed;
                bottom: 80px;
                right: 18px;
                z-index: ${CFG.zIndex + 1};
                background: #1e1e2e;
                border: 1px solid #555;
                border-radius: 10px;
                padding: 8px 10px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                box-shadow: 0 4px 20px rgba(0,0,0,.5);
                font-family: sans-serif;
                font-size: 12px;
                user-select: none;
                min-width: 130px;
            }
            #tcc-draw-panel button {
                background: #3a3a4e;
                color: #fff;
                border: 1px solid #666;
                border-radius: 6px;
                padding: 5px 10px;
                cursor: pointer;
                width: 100%;
                text-align: left;
                font-size: 12px;
            }
            #tcc-draw-panel button:hover { filter: brightness(1.2); }
            #tcc-btn-toggle.on { background: #27ae60 !important; }
            #tcc-draw-panel input[type=color] {
                width: 100%; height: 24px;
                border: none; border-radius: 4px;
                cursor: pointer; padding: 0;
            }
            #tcc-draw-panel input[type=range] {
                width: 100%; cursor: pointer;
            }
            #tcc-draw-panel .tcc-label {
                color: #aaa; font-size: 11px;
            }
        `);
        // ── Botão toggle ───────────────────────────────────────
        const btnToggle = document.createElement('button');
        btnToggle.id = 'tcc-btn-toggle';
        btnToggle.textContent = '✏️ Desenho OFF';
        btnToggle.addEventListener('click', toggleDrawMode);
        // ── Botão limpar ───────────────────────────────────────
        const btnClear = document.createElement('button');
        btnClear.textContent = '🗑️ Limpar';
        btnClear.addEventListener('click', clearCanvas);
        // ── Seletor de cor ─────────────────────────────────────
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = '#dc3232';
        colorPicker.title = 'Cor do traço';
        colorPicker.addEventListener('input', (e) => {
            const { r, g, b } = hexToRgb(e.target.value);
            CFG.strokeColor = `rgba(${r},${g},${b},0.72)`;
            if (ctx) ctx.strokeStyle = CFG.strokeColor;
        });
        // ── Slider espessura ───────────────────────────────────
        const label = document.createElement('span');
        label.className = 'tcc-label';
        label.textContent = `Espessura: ${CFG.lineWidth}px`;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'tcc-slider';
        slider.min = '1';
        slider.max = '20';
        slider.value = String(CFG.lineWidth);
        slider.addEventListener('input', (e) => {
            if (ctx) ctx.lineWidth = parseInt(e.target.value);
            label.textContent = `Espessura: ${e.target.value}px`;
        });
        panel.append(btnToggle, btnClear, colorPicker, label, slider);
        document.body.appendChild(panel);
    }

    // ══════════════════════════════════════════════════════════
    //  CONTROLES DO MODO DESENHO
    // ══════════════════════════════════════════════════════════
    function toggleDrawMode() {
        drawMode = !drawMode;
        const btn = document.getElementById('tcc-btn-toggle');
        if (drawMode) {
            if (canvas) canvas.style.pointerEvents = 'auto';
            if (btn) { btn.textContent = '✏️ Desenho ON';  btn.classList.add('on'); }
        } else {
            if (canvas) canvas.style.pointerEvents = 'none';
            isDrawing = false;
            if (btn) { btn.textContent = '✏️ Desenho OFF'; btn.classList.remove('on'); }
        }
    }
    function clearCanvas() {
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // ══════════════════════════════════════════════════════════
    //  HANDLERS DE DESENHO (mouse)
    // ══════════════════════════════════════════════════════════
    function canvasPoint(clientX, clientY) {
        const bcr = canvas.getBoundingClientRect();
        return {
            x: (clientX - bcr.left) * (canvas.width / bcr.width),
            y: (clientY - bcr.top) * (canvas.height / bcr.height),
        };
    }
    function onDown(e) {
        if (!drawMode) return;
        isDrawing = true;
        const p = canvasPoint(e.clientX, e.clientY);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        e.preventDefault();
    }
    function onMove(e) {
        if (!drawMode || !isDrawing) return;
        const p = canvasPoint(e.clientX, e.clientY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        e.preventDefault();
    }
    function onUp() {
        if (isDrawing) { ctx.closePath(); isDrawing = false; }
    }

    // ══════════════════════════════════════════════════════════
    //  HANDLERS DE DESENHO (touch)
    // ══════════════════════════════════════════════════════════
    function onTouchDown(e) {
        if (!drawMode || !e.touches[0]) return;
        const t = e.touches[0];
        isDrawing = true;
        const p = canvasPoint(t.clientX, t.clientY);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        e.preventDefault();
    }
    function onTouchMove(e) {
        if (!drawMode || !isDrawing || !e.touches[0]) return;
        const t = e.touches[0];
        const p = canvasPoint(t.clientX, t.clientY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        e.preventDefault();
    }

    // ══════════════════════════════════════════════════════════
    //  SCROLL / RESIZE
    // ══════════════════════════════════════════════════════════
    window.addEventListener('scroll', () => { positionCanvas(); }, { passive: true });
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { positionCanvas(); }, 200);
    }, { passive: true });

    // ══════════════════════════════════════════════════════════
    //  DETECÇÃO DE TROCA DE QUESTÃO (MutationObserver)
    // ══════════════════════════════════════════════════════════
    function setupObserver() {
        const article = getArticle();
        if (!article) return;
        if (observer) observer.disconnect();
        currentQId = getQId();
        observer = new MutationObserver(() => {
            const newId = getQId();
            if (!newId || newId === currentQId) return;
            currentQId = newId;
            const wasOn = drawMode;
            // Recriar canvas limpo para nova questão
            if (wasOn) drawMode = false;
            createCanvas();
            // Restaurar modo desenho se estava ativo
            if (wasOn) {
                drawMode = true;
                if (canvas) canvas.style.pointerEvents = 'auto';
                const btn = document.getElementById('tcc-btn-toggle');
                if (btn) { btn.textContent = '✏️ Desenho ON'; btn.classList.add('on'); }
            }
            // Reobservar (mesmo article, conteúdo novo)
            observer.observe(article, { childList: true, subtree: true });
        });
        observer.observe(article, { childList: true, subtree: true });
    }

    // ══════════════════════════════════════════════════════════
    //  UTILITÁRIO: hex → rgb
    // ══════════════════════════════════════════════════════════
    function hexToRgb(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        };
    }

    // ══════════════════════════════════════════════════════════
    //  INICIALIZAÇÃO
    // ══════════════════════════════════════════════════════════
    function init() {
        createCanvas();
        createPanel();
        setupObserver();
        console.log('[TCC-DRAW] Iniciado. Questão:', currentQId);
    }

    // Aguardar o article existir (SPA pode carregar depois do DOM)
    if (getArticle()) {
        init();
    } else {
        const waitObs = new MutationObserver(() => {
            if (getArticle()) { waitObs.disconnect(); init(); }
        });
        waitObs.observe(document.body, { childList: true, subtree: true });
    }
})();
