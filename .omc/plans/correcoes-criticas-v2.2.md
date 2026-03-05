# Plano de Implementação: Correções Críticas v2.2

**Data:** 2026-03-03 (Revisado após 2º feedback do Architect)
**Versão:** v2.1 → v2.2 (patch increment)
**Arquivo:** `/Users/gabrielramos/TecTools/tecconcursos-desenho.user.js`

---

## Status das Correções (após 2ª revisão do Architect)

| ID | Correção | Status | Observações |
|----|----------|--------|-------------|
| 1 | Error handling em `saveToLocalStorage()` | ✅ APROVADO | Implementação conforme proposto |
| 2 | Reset de histórico após resize | ⚠️ CORRIGIDO | Apenas `updateUndoButton()` (sem `saveToHistory()`) |
| 3 | Remoção de touch indicator | ❌ REJEITADO | Elemento é reutilizado (lazy init), não há vazamento |
| 4 | Validação de dimensões ao carregar | ✅ APROVADO | Recusar carregar se dimensões não baterem |

---

## Resumo Executivo

Este plano aborda 3 correções críticas identificadas no sistema de desenho do TecConcursos:

1. **[ALTA]** Validação de dimensões em `loadFromLocalStorage()` - previne desenho distorcido (prioridade máxima)
2. **[ALTA]** Reset completo de histórico após resize - apenas `updateUndoButton()`
3. **[MÉDIA]** Error handling em `saveToLocalStorage()` - previne quebra do script quando localStorage estiver cheio

---

## Contexto

O script `tecconcursos-desenho.user.js` permite desenhar sobre questões do TecConcursos. As 3 correções são independentes e podem ser implementadas sequencialmente sem conflitos.

---

## Objetivos do Trabalho

### Objetivo Principal
Corrigir 3 bugs críticos que afetam a estabilidade e usabilidade do script de desenho, priorizando por impacto.

### Guardrails

**Must Have (Obrigatório):**
- Histórico resetado após resize com `updateUndoButton()` (sem `saveToHistory()`)
- Validação de dimensões ao carregar do localStorage - recusar se não bater
- Histórico inicializado com `saveToHistory()` quando dimensões não batem
- Error handling robusto para localStorage (QuotaExceededError)

**Must NOT Have (Proibido):**
- Não adicionar novas features
- Não alterar comportamentos existentes além das correções
- Não modificar seletor CSS ou lógica de detecção de questão
- Não remover touch indicator (rejeitado pelo Architect - lazy init é padrão correto)

### Notas do Architect (2ª revisão)
- **TODO 2 (dimensões) é o mais crítico**: Previne corrupção visual ao carregar anotações salvas
- **TODO 1 (resize)**: Apenas `updateUndoButton()` - `saveToHistory()` após `history = []` é ilógico
- **TODO 2 deve inicializar histórico**: Quando dimensões não batem, chamar `saveToHistory()` para criar estado inicial vazio
- **Ordem recomendada**: TODO 1 → TODO 2 → TODO 3 → TODO 4

---

## Fluxo de Trabalho

```
┌─────────────────────────────────────────────────────────────┐
│  1. Corrigir loadFromLocalStorage() - validar dimensões (336-348)│
│     ↓                                                        │
│  2. Corrigir positionCanvas() - resize completo (linhas 111-120)│
│     ↓                                                        │
│  3. Corrigir saveToLocalStorage() - error handling (329-334) │
│     ↓                                                        │
│  4. Atualizar versão e log de mudanças                      │
└─────────────────────────────────────────────────────────────┘
```

**Ordem justificada:**
1. **Dimensões primeiro**: Mais crítico - previne corrupção visual e define comportamento de inicialização
2. **Resize segundo**: Corrige estado do botão desfazer após redimensionamento
3. **Error handling terceiro**: Edge case, baixa frequência mas alta criticidade

---

## TODOs Detalhados

### TODO 1: Validar Dimensões ao Carregar do LocalStorage

**Linhas:** 336-348
**Prioridade:** ALTA (mais crítico - previne corrupção visual)
**Complexidade:** BAIXA

**Problema atual:**
```javascript
function loadFromLocalStorage() {
    const qId = getQId();
    if (!qId || !canvas) return;
    const dataUrl = localStorage.getItem(`tcc-draw-${qId}`);
    if (dataUrl) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);  // SEM VALIDAÇÃO DE DIMENSÕES
            saveToHistory();
        };
        img.src = dataUrl;
    }
}
```

Se a imagem salva tem dimensões diferentes do canvas atual (ex: usuário redimensionou a janela entre sessões), o desenho fica distorcido.

**Solução (conforme Architect - Opção A):**
```javascript
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
```

**Comportamento esperado:**
- Se dimensões batem: carrega imagem normalmente, salva no histórico
- Se dimensões não batem: mantém canvas vazio, loga aviso, inicializa histórico vazio

**Critérios de Aceite:**
- [ ] Imagem só é desenhada se dimensões batem exatamente
- [ ] Aviso claro no console quando dimensões não batem
- [ ] Canvas permanece limpo se dimensões não batem
- [ ] `saveToHistory()` é chamado no branch else para inicializar histórico vazio
- [ ] Botão desfazer funciona corretamente após carregamento com dimensões incompatíveis

**Estratégia de Teste:**
1. Ativar desenho, fazer traços, marcar "Manter anotações"
2. Redimensionar janela significativamente
3. Recarregar página (F5)
4. Verificar console para aviso de dimensões
5. Verificar que canvas está limpo (não distorcido)
6. Verificar que botão desfazer está desabilitado

---

### TODO 2: Corrigir Reset de Histórico Após Resize

**Linhas:** 111-120
**Prioridade:** ALTA
**Complexidade:** BAIXA

**Problema atual:**
```javascript
if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    applyCtxStyle();
    // Limpar histórico após resize (dimensões mudaram)
    history = [];
    historyStep = -1;
}
```

O histórico é limpo mas `updateUndoButton()` não é chamado → botão fica com estado incorreto.

**Erro lógico identificado pelo Architect:**
Chamar `saveToHistory()` após `history = []` não faz sentido, pois estaria salvando um canvas vazio no histórico.

**Solução corrigida (apenas updateUndoButton):**
```javascript
if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    applyCtxStyle();
    // Limpar histórico após resize (dimensões mudaram)
    history = [];
    historyStep = -1;
    updateUndoButton();   // ADICIONAR: atualizar botão (apenas isso)
}
```

**Critérios de Aceite:**
- [ ] Botão desfazer fica desabilitado após resize
- [ ] Botão desfazer volta a funcionar para novos traços pós-resize
- [ ] Opacidade visual do botão reflete estado correto (0.5 quando desabilitado)

**Estratégia de Teste:**
1. Ativar modo desenho
2. Fazer alguns traços
3. Redimensionar a janela do navegador
4. Verificar que botão desfazer está desabilitado (opacidade 0.5)
5. Fazer novos traços
6. Verificar que botão desfazer funciona corretamente

---

### TODO 3: Adicionar Error Handling em saveToLocalStorage()

**Linhas:** 329-334
**Prioridade:** MÉDIA
**Complexidade:** BAIXA

**Problema atual:**
```javascript
function saveToLocalStorage() {
    const qId = getQId();
    if (!qId || !canvas) return;
    const dataUrl = canvas.toDataURL();
    localStorage.setItem(`tcc-draw-${qId}`, dataUrl);  // Pode lançar QuotaExceededError
}
```

**Solução:**
```javascript
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
```

**Critérios de Aceite:**
- [ ] localStorage cheio não quebra o script
- [ ] Erro logado no console com contexto claro
- [ ] Comportamento normal mantido quando localStorage funciona

**Estratégia de Teste:**
1. Abrir console do navegador (F12)
2. Preencher localStorage até quota excedida:
   ```javascript
   // Rodar no console antes de ativar o modo desenho
   let data = 'x'.repeat(1024 * 1024); // 1MB
   try { localStorage.setItem('filler', data); } catch(e) {}
   ```
3. Ativar modo desenho, fazer traços
4. Verificar que não há erro não tratado no console
5. Desenho deve funcionar normalmente (apenas não salva)

---

### TODO 4: Atualizar Versão e Changelog

**Linhas:** 4 (version), 5 (description), 532 (console.log)

**Alterações:**
```javascript
// @version      2.2
// @description  Permite desenhar à mão livre (grifar/riscar) sobre a questão. Anotações somem ao trocar de questão. v2.2: correções críticas.
```

```javascript
// Linha 532:
console.log('[TCC-DRAW v2.2] Correções críticas aplicadas. Questão:', currentQId);
```

---

## Critérios de Sucesso Globais

- [ ] As 3 correções foram aplicadas (dimensões, resize, error handling)
- [ ] Nenhuma regressão introduzida
- [ ] Testes manuais passam
- [ ] Versão atualizada para 2.2
- [ ] Git commit criado com mensagem descritiva

---

## Estratégia de Testes Completa

### Pré-teste: Setup
1. Fazer backup do script atual
2. Instalar versão modificada no Tampermonkey/Violentmonkey

### Teste 1: Validação de Dimensões (TODO 1 - MAIS CRÍTICO)
1. Ativar desenho (D)
2. Fazer traços visíveis
3. Marcar "Manter anotações"
4. Redimensionar janela (mudar largura significativamente)
5. Recarregar página (F5)
6. Verificar console: aviso de dimensões diferentes
7. Verificar: canvas está limpo (não distorcido)
8. Verificar: botão desfazer está desabilitado (histórico inicializado vazio)

### Teste 2: Resize Completo (TODO 2)
1. Ativar desenho (D)
2. Fazer 3 traços
3. Redimensionar janela significativamente
4. Verificar: botão desfazer desabilitado (opacidade 0.5)
5. Fazer 2 traços
6. Clicar desfazer
7. Verificar: último traço desfeito, botão funciona

### Teste 3: localStorage Cheio (TODO 3)
```javascript
// Console do navegador antes de usar desenho
for (let i = 0; i < 100; i++) {
    try {
        localStorage.setItem('test' + i, 'x'.repeat(1024 * 1024));
    } catch(e) { break; }
}
```
- Ativar desenho
- Fazer traços
- Marcar "Manter anotações"
- Verificar: console loga aviso, script não quebra
- Desenho deve funcionar normalmente (apenas não salva)

### Teste 4: Regressão
- Ativar/desativar modo (D)
- Limpar (C)
- Borracha (E)
- Desfazer (Ctrl+Z)
- Persistência checkbox
- Trocar de questão
- Todas features originais devem funcionar

---

## Versão e Release

**Versionamento:** SemVer (Semantic Versioning)
- v2.1 → v2.2 (PATCH): correções de bugs sem breaking changes

**Commit message sugerido:**
```
Fix: v2.2 - 3 correções críticas no sistema de desenho

- [CRÍTICO] Validação de dimensões ao carregar do localStorage (previne distorção)
- [CRÍTICO] Reset de histórico após resize com updateUndoButton()
- [MÉDIA] Error handling em saveToLocalStorage() para QuotaExceededError

Melhora confiabilidade do undo/redraw system e previne corrupção visual
ao carregar anotações salvas com dimensões incompatíveis.
```

---

## Notas de Implementação

1. **Ordem:** Implementar na ordem TODO 1 → TODO 2 → TODO 3 → TODO 4 (conforme fluxo acima)
   - TODO 1 (dimensões) primeiro: mais crítico, define comportamento de inicialização
2. **Independência:** Cada correção é independente, pode ser testada isoladamente
3. **Risco:** BAIXO - mudanças localizadas e bem delimitadas
4. **Tempo estimado:** 15-20 minutos para implementação + testes

**Correções do 2º feedback do Architect:**
- TODO 1 (ex-resize): Removido `saveToHistory()` - ilógico salvar canvas vazio após `history = []`
- TODO 2 (ex-dimensões agora TODO 1): Adicionado `saveToHistory()` no branch else para inicializar histórico vazio
- Ordem reorganizada: dimensões (mais crítico) → resize → error handling → versão

---

## Histórico de Revisões

| Data | Alteração | Autor |
|------|-----------|-------|
| 2026-03-03 | Plano inicial criado | Planner |
| 2026-03-03 | 1ª revisão após feedback do Architect | Planner |
| | - TODO 2 expandido (faltava saveToHistory) | |
| | - TODO 3 removido (touch indicator rejeitado) | |
| | - TODO 2 adicionado (validação de dimensões) | |
| 2026-03-03 | 2ª revisão - correção lógica do TODO 1 | Planner |
| | - TODO 1 (resize): removeu saveToHistory() - ilógico | |
| | - TODO 2 (dimensões): adicionou saveToHistory() no else | |
| | - Ordem reorganizada: dimensões → resize → error | |

---

## Open Questions

Nenhuma - escopo bem definido e fechado após 2ª revisão do Architect.
Todas as decisões foram tomadas:
- Comportamento claro quando dimensões não batem (recusar, inicializar histórico vazio)
- Reset de resize sem `saveToHistory()` (apenas `updateUndoButton()`)
- Ordem de execução definida por criticidade

---

**Plano revisado e pronto para execução em 2026-03-03**

**Próximo passo:** Executar via `/oh-my-claudecode:start-work correcoes-criticas-v2.2`
