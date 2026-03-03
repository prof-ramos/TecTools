// ==UserScript==
// @name         TecConcursos - Desenho Livre sobre Questões
// @namespace    https://tecconcursos.com.br/
// @version      2.2
// @description  Permite desenhar à mão livre (grifar/riscar) sobre a questão. Anotações somem ao trocar de questão. v2.2: correções críticas.
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
        maxHistory: 20,                          // máximo de estados para desfazer
        // Seletores CSS — altere somente se o site mudar a estrutura
        selArticle: 'article.questao-enunciado',
        selIdInput: '.questao-rg-area-coluna-1 input[type="hidden"]',
    };

    // ══════════════════════════════════════════════════════════
    //  ESTADO INTERNO
    // ══════════════════════════════════════════════════════════
    let canvas = null;         // elemento <canvas>
    let ctx = null;            // contexto 2D
    let panel = null;          // painel flutuante
    let observer = null;       // MutationObserver
    let drawMode = false;      // modo desenho ativo?
    let isDrawing = false;     // botão do mouse pressionado?
    let eraserMode = false;    // modo borracha ativo?
    let currentQId = null;     // ID da questão atual
    let resizeTimer = null;
    let history = [];          // histórico para desfazer
    let historyStep = -1;      // posição atual no histórico
    let touchIndicator = null; // indicador visual para touch

    // ══════════════════════════════════════════════════════════
    //  UTILITÁRIOS
    // ══════════════════════════════════════════════════════════
    const getArticle = () => document.querySelector(CFG.selArticle);
    const getQId = () => document.querySelector(CFG.selIdInput)?.value ?? null;

    /** Salva estado atual no histórico */
    function saveToHistory() {
        if (!canvas) return;
        // Remover estados futuros se estamos no meio do histórico
        if (historyStep < history.length - 1) {
            history = history.slice(0, historyStep + 1);
        }
        // Salvar snapshot
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        // Limitar tamanho do histórico
        if (history.length > CFG.maxHistory) {
            history.shift();
        } else {
            historyStep++;
        }
        updateUndoButton();
    }

    /** Desfaz última ação */
    function undo() {
        if (historyStep > 0) {
            historyStep--;
            ctx.putImageData(history[historyStep], 0, 0);
            updateUndoButton();
        }
    }

    /** Atualiza estado do botão desfazer */
    function updateUndoButton() {
        const btn = document.getElementById('tcc-btn-undo');
        if (btn) {
            btn.disabled = historyStep <= 0;
            btn.style.opacity = historyStep <= 0 ? '0.5' : '1';
        }
    }

    /** Aplica o estilo de traço ao ctx */
    function applyCtxStyle() {
        if (!ctx) return;
        if (eraserMode) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = parseInt(document.getElementById('tcc-slider')?.value ?? CFG.lineWidth * 2);
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = CFG.strokeColor;
            ctx.lineWidth = parseInt(document.getElementById('tcc-slider')?.value ?? CFG.lineWidth);
        }
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    }

    /** Posiciona e redimensiona o canvas */
    function positionCanvas() {
        const article = getArticle();
        if (!article || !canvas) return;
        const bcr = article.getBoundingClientRect();
        const w = Math.round(bcr.width);
        const h = Math.round(bcr.height);
        canvas.style.top = bcr.top + 'px';
        canvas.style.left = bcr.left + 'px';
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            applyCtxStyle();
            // Limpar histórico após resize (dimensões mudaram)
            history = [];
            historyStep = -1;
            updateUndoButton();   // Atualizar botão desfazer
        }
    }

    /** Mostra indicador visual no touch */
    function showTouchIndicator(x, y) {
        if (!touchIndicator) {
            touchIndicator = document.createElement('div');
            touchIndicator.id = 'tcc-touch-indicator';
            touchIndicator.style.cssText = `
                position: fixed;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: rgba(220, 50, 50, 0.3);
                border: 2px solid rgba(220, 50, 50, 0.6);
                pointer-events: none;
                z-index: ${CFG.zIndex + 2};
                transform: translate(-50%, -50%);
                transition: opacity 0.1s;
            `;
            document.body.appendChild(touchIndicator);
        }
        touchIndicator.style.left = x + 'px';
        touchIndicator.style.top = y + 'px';
        touchIndicator.style.opacity = '1';
    }

    /** Esconde indicador visual */
    function hideTouchIndicator() {
        if (touchIndicator) {
            touchIndicator.style.opacity = '0';
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
            pointerEvents: 'none',
            cursor: eraserMode ? 'cell' : 'crosshair',
            boxSizing: 'border-box',
        });
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        applyCtxStyle();
        // Inicializar histórico
        history = [];
        historyStep = -1;
        saveToHistory();
        // Eventos
        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseup', onUp);
        canvas.addEventListener('mouseleave', onUp);
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
                max-height: 80vh;
                overflow-y: auto;
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
            #tcc-draw-panel button:disabled { opacity: 0.5; cursor: not-allowed; }
            #tcc-btn-toggle.on { background: #27ae60 !important; }
            #tcc-btn-eraser.active { background: #e74c3c !important; }
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
            #tcc-draw-panel .tcc-shortcuts {
                color: #888;
                font-size: 10px;
                border-top: 1px solid #444;
                padding-top: 6px;
                margin-top: 4px;
            }
        `);
        // Botão toggle
        const btnToggle = document.createElement('button');
        btnToggle.id = 'tcc-btn-toggle';
        btnToggle.textContent = '✏️ Desenho OFF';
        btnToggle.addEventListener('click', toggleDrawMode);
        // Botão limpar
        const btnClear = document.createElement('button');
        btnClear.textContent = '🗑️ Limpar';
        btnClear.addEventListener('click', () => {
            clearCanvas();
            saveToHistory();
        });
        // Botão desfazer
        const btnUndo = document.createElement('button');
        btnUndo.id = 'tcc-btn-undo';
        btnUndo.textContent = '↩️ Desfazer (Ctrl+Z)';
        btnUndo.addEventListener('click', undo);
        // Botão borracha
        const btnEraser = document.createElement('button');
        btnEraser.id = 'tcc-btn-eraser';
        btnEraser.textContent = '🧽 Borracha (E)';
        btnEraser.addEventListener('click', toggleEraser);
        // Checkbox persistência
        const persistContainer = document.createElement('div');
        persistContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; color: #aaa; font-size: 11px;';
        const persistCheckbox = document.createElement('input');
        persistCheckbox.type = 'checkbox';
        persistCheckbox.id = 'tcc-persist';
        persistCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                saveToLocalStorage();
            }
        });
        const persistLabel = document.createElement('label');
        persistLabel.htmlFor = 'tcc-persist';
        persistLabel.textContent = 'Manter anotações';
        persistContainer.append(persistCheckbox, persistLabel);
        // Seletor de cor
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = '#dc3232';
        colorPicker.title = 'Cor do traço';
        colorPicker.addEventListener('input', (e) => {
            const { r, g, b } = hexToRgb(e.target.value);
            CFG.strokeColor = `rgba(${r},${g},${b},0.72)`;
            if (ctx && !eraserMode) ctx.strokeStyle = CFG.strokeColor;
        });
        // Slider espessura
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
        // Atalhos
        const shortcuts = document.createElement('div');
        shortcuts.className = 'tcc-shortcuts';
        shortcuts.innerHTML = '⌨️ D: Toggle | C: Limpar | E: Borracha | Ctrl+Z: Desfazer';
        panel.append(btnToggle, btnUndo, btnEraser, btnClear, persistContainer, colorPicker, label, slider, shortcuts);
        document.body.appendChild(panel);
        updateUndoButton();
    }

    // ══════════════════════════════════════════════════════════
    //  PERSISTÊNCIA LOCAL
    // ══════════════════════════════════════════════════════════
    function saveToLocalStorage() {
        const qId = getQId();
        if (!qId || !canvas) return;
        try {
            const dataUrl = canvas.toDataURL();
            localStorage.setItem(`tcc-draw-${qId}`, dataUrl);
        } catch (e) {
            // Silenciar erro de quota ou avisar o usuário via console
            if (e.name === 'QuotaExceededError') {
                console.warn('[TCC-DRAW] localStorage cheio. Anotações não serão salvas.');
            } else {
                console.error('[TCC-DRAW] Erro ao salvar:', e);
            }
        }
    }

    function loadFromLocalStorage() {
        const qId = getQId();
        if (!qId || !canvas) return;
        const dataUrl = localStorage.getItem(`tcc-draw-${qId}`);
        if (dataUrl) {
            const img = new Image();
            img.onload = () => {
                // Validar dimensões antes de desenhar
                if (img.width === canvas.width && img.height === canvas.height) {
                    ctx.drawImage(img, 0, 0);
                    saveToHistory();
                } else {
                    // Dimensões não batem: recusar carregar, inicializar histórico vazio
                    console.warn('[TCC-DRAW] Dimensões da imagem salva diferem do canvas atual.',
                        `Salvas: ${img.width}x${img.height}, Atual: ${canvas.width}x${canvas.height}`,
                        'Anotações não foram carregadas para evitar distorção.');
                    saveToHistory();  // Inicializa histórico vazio para desfazer funcionar
                }
            };
            img.src = dataUrl;
        }
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

    function toggleEraser() {
        eraserMode = !eraserMode;
        const btn = document.getElementById('tcc-btn-eraser');
        if (eraserMode) {
            btn.classList.add('active');
            if (canvas) canvas.style.cursor = 'cell';
        } else {
            btn.classList.remove('active');
            if (canvas) canvas.style.cursor = 'crosshair';
        }
        applyCtxStyle();
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
        if (isDrawing) {
            ctx.closePath();
            isDrawing = false;
            saveToHistory();
            // Salvar no localStorage se habilitado
            if (document.getElementById('tcc-persist')?.checked) {
                saveToLocalStorage();
            }
        }
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
        showTouchIndicator(t.clientX, t.clientY);
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
        showTouchIndicator(t.clientX, t.clientY);
        e.preventDefault();
    }

    // ══════════════════════════════════════════════════════════
    //  ATALHOS DE TECLADO
    // ══════════════════════════════════════════════════════════
    document.addEventListener('keydown', (e) => {
        // Ignorar se está em input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            toggleDrawMode();
        } else if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            clearCanvas();
            saveToHistory();
        } else if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            toggleEraser();
        } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
    });

    // ══════════════════════════════════════════════════════════
    //  SCROLL / RESIZE
    // ══════════════════════════════════════════════════════════
    window.addEventListener('scroll', () => { positionCanvas(); }, { passive: true });
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { positionCanvas(); }, 200);
    }, { passive: true });

    // ══════════════════════════════════════════════════════════
    //  DETECÇÃO DE TROCA DE QUESTÃO
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
            const persistEnabled = document.getElementById('tcc-persist')?.checked;
            if (wasOn) drawMode = false;
            createCanvas();
            // Carregar do localStorage se habilitado
            if (persistEnabled) {
                loadFromLocalStorage();
            }
            if (wasOn) {
                drawMode = true;
                if (canvas) canvas.style.pointerEvents = 'auto';
                const btn = document.getElementById('tcc-btn-toggle');
                if (btn) { btn.textContent = '✏️ Desenho ON'; btn.classList.add('on'); }
            }
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
        console.log('[TCC-DRAW v2.2] Correções críticas aplicadas. Questão:', currentQId);
    }

    if (getArticle()) {
        init();
    } else {
        const waitObs = new MutationObserver(() => {
            if (getArticle()) { waitObs.disconnect(); init(); }
        });
        waitObs.observe(document.body, { childList: true, subtree: true });
    }
})();
