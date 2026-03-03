// ==UserScript==
// @name         TecConcursos - Desenho Livre
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Permite desenhar à mão livre sobre questões do TecConcursos
// @author       Você
// @match        https://www.tecconcursos.com.br/questoes/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURAÇÕES ====================
    const CONFIG = {
        // Cores do traço (você pode mudar estas cores)
        strokeColor: 'rgba(255, 0, 0, 0.5)',  // Vermelho semi-transparente
        lineWidth: 4,                         // Espessura do traço
        lineCap: 'round',                     // Pontas arredondadas
        lineJoin: 'round',                    // Junções arredondadas

        // Seletores (ajuste se necessário)
        questaoSelector: '.questao',
        enunciadoSelector: '.questao-enunciado-texto',
        numeroSelector: '.questao-cabecalho-informacoes-numero',

        // Intervalo de verificação (ms)
        checkInterval: 500
    };

    // ==================== ESTADO GLOBAL ====================
    const state = {
        isDrawing: false,
        drawMode: false,
        currentQuestionHash: null,
        canvas: null,
        ctx: null,
        container: null,
        panel: null,
        lastX: 0,
        lastY: 0
    };

    // ==================== FUNÇÕES UTILITÁRIAS ====================
    function getQuestionHash() {
        const enunciado = document.querySelector(CONFIG.enunciadoSelector);
        const numeroEl = document.querySelector(CONFIG.numeroSelector);

        let hash = '';
        if (numeroEl) {
            const match = numeroEl.textContent.match(/Questão\s+(\d+)\s+de\s+(\d+)/);
            if (match) hash += `Q${match[1]}_`;
        }
        if (enunciado) {
            hash += enunciado.textContent.substring(0, 100).replace(/\s+/g, ' ');
        }
        return hash || hash;
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'tec-draw-panel';
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 999999;
                background: white;
                border: 2px solid #ccc;
                border-radius: 8px;
                padding: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                font-family: Arial, sans-serif;
                font-size: 14px;
            ">
                <div style="margin-bottom: 8px; font-weight: bold;">Desenho Livre</div>
                <button id="tec-draw-toggle" style="
                    width: 100%;
                    padding: 8px 12px;
                    margin-bottom: 5px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                ">Desenho ON</button>
                <button id="tec-draw-clear" style="
                    width: 100%;
                    padding: 8px 12px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                ">Limpar</button>
            </div>
        `;

        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('tec-draw-toggle').addEventListener('click', toggleDrawMode);
        document.getElementById('tec-draw-clear').addEventListener('click', clearCanvas);

        return panel;
    }

    function createCanvas() {
        // Remover canvas anterior se existir
        if (state.canvas) {
            state.canvas.remove();
        }

        const container = document.querySelector(CONFIG.questaoSelector);
        if (!container) return null;

        const rect = container.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        canvas.id = 'tec-draw-canvas';

        canvas.style.cssText = `
            position: absolute;
            top: ${rect.top + window.scrollY}px;
            left: ${rect.left + window.scrollX}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            z-index: 999998;
            pointer-events: none;
            background: transparent;
        `;

        canvas.width = rect.width;
        canvas.height = rect.height;

        document.body.appendChild(canvas);

        state.canvas = canvas;
        state.container = container;
        state.ctx = canvas.getContext('2d');

        setupCanvasEvents();
        return canvas;
    }

    function updateCanvasPosition() {
        if (!state.canvas || !state.container) return;

        const rect = state.container.getBoundingClientRect();
        state.canvas.style.top = (rect.top + window.scrollY) + 'px';
        state.canvas.style.left = (rect.left + window.scrollX) + 'px';
    }

    function setupCanvasEvents() {
        const canvas = state.canvas;
        if (!canvas) return;

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        // Touch events para mobile
        canvas.addEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchend', stopDrawing);
    }

    function handleTouchStart(e) {
        if (!state.drawMode) return;
        e.preventDefault();
        const touch = e.touches[0];
        startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function handleTouchMove(e) {
        if (!state.drawMode || !state.isDrawing) return;
        e.preventDefault();
        const touch = e.touches[0];
        draw({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function startDrawing(e) {
        if (!state.drawMode) return;

        const rect = state.canvas.getBoundingClientRect();
        state.isDrawing = true;
        state.lastX = e.clientX - rect.left;
        state.lastY = e.clientY - rect.top;
    }

    function draw(e) {
        if (!state.isDrawing || !state.drawMode) return;

        const rect = state.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        state.ctx.strokeStyle = CONFIG.strokeColor;
        state.ctx.lineWidth = CONFIG.lineWidth;
        state.ctx.lineCap = CONFIG.lineCap;
        state.ctx.lineJoin = CONFIG.lineJoin;

        state.ctx.beginPath();
        state.ctx.moveTo(state.lastX, state.lastY);
        state.ctx.lineTo(x, y);
        state.ctx.stroke();

        state.lastX = x;
        state.lastY = y;
    }

    function stopDrawing() {
        state.isDrawing = false;
    }

    function toggleDrawMode() {
        state.drawMode = !state.drawMode;
        const btn = document.getElementById('tec-draw-toggle');

        if (state.drawMode) {
            btn.textContent = 'Desenho ON';
            btn.style.background = '#4CAF50';
            state.canvas.style.pointerEvents = 'auto';
        } else {
            btn.textContent = 'Desenho OFF';
            btn.style.background = '#9E9E9E';
            state.canvas.style.pointerEvents = 'none';
        }
    }

    function clearCanvas() {
        if (!state.canvas || !state.ctx) return;
        state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    }

    function resetCanvas() {
        clearCanvas();
        createCanvas();
    }

    // ==================== DETECÇÃO DE MUDANÇA DE QUESTÃO ====================
    function checkQuestionChange() {
        const newHash = getQuestionHash();

        if (state.currentQuestionHash && newHash !== state.currentQuestionHash) {
            console.log('[TecDraw] Questão mudou! Resetando canvas...');
            resetCanvas();
            state.currentQuestionHash = newHash;
        } else if (!state.currentQuestionHash) {
            state.currentQuestionHash = newHash;
        }
    }

    function setupMutationObserver() {
        const container = document.querySelector(CONFIG.questaoSelector);
        if (!container) return;

        const observer = new MutationObserver((mutations) => {
            checkQuestionChange();
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });

        console.log('[TecDraw] Observer configurado');
    }

    // ==================== EVENTOS GLOBAIS ====================
    function setupGlobalEvents() {
        // Scroll - atualizar posição do canvas
        window.addEventListener('scroll', updateCanvasPosition);

        // Resize - recriar canvas
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resetCanvas();
            }, 250);
        });
    }

    // ==================== INICIALIZAÇÃO ====================
    function init() {
        console.log('[TecDraw] Inicializando...');

        // Criar painel de controle
        state.panel = createPanel();

        // Criar canvas inicial
        createCanvas();

        // Guardar hash da questão atual
        state.currentQuestionHash = getQuestionHash();

        // Configurar observer para detectar mudanças
        setupMutationObserver();

        // Configurar eventos globais
        setupGlobalEvents();

        // Verificação periódica (backup)
        setInterval(checkQuestionChange, CONFIG.checkInterval);

        console.log('[TecDraw] Inicializado com sucesso!');
    }

    // Aguardar a página carregar completamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
