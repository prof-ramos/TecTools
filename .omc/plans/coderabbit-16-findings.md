# Plano de Implementação: Correção das 16 Findings CodeRabbit

**Data:** 2026-03-05
**Versão:** 1.4
**Branch:** `feature/desenhos-melhorias`
**Arquivos afetados:** 12 arquivos

---

## Resumo Executivo

Este plano aborda 16 findings identificados pelo CodeRabbit, organizados em 7 categorias por criticidade e tipo de alteração. As correções priorizam segurança (remoção de dados sensíveis do controle de versão) antes de melhorias de código (nitpicks).

**Distribuição:**
- **potential_issue (9):** Arquivos sensíveis committed, handlers faltantes, paths hardcoded
- **nitpick (7):** Validacoes de borda, normalizacao de paths, duplicacao de linhas

---

## Objetivos do Trabalho

### Objetivo Principal
Corrigir todos os 16 findings do CodeRabbit, priorizando:
1. Remoção de dados sensíveis/arquivos de runtime do versionamento
2. Correção de bugs reais (handlers não chamados, suporte Mac)
3. Ajustes de estilo e normalização

### Guardrails

**Must Have (Obrigatório):**
- `.gitignore` criado com padrões para `.omc/state/`, `repomix-output.xml`, `.omc/project-memory.json`
- Arquivos de runtime removidos do git index
- `hideTouchIndicator()` chamado no handler apropriado
- Suporte a Cmd key (Mac) no handler de undo
- Guard against zero-dimensions em `saveToHistory()`
- Path hardcoded em `project-memory.json` sanitizado

**Must NOT Have (Proibido):**
- Não remover funcionalidades existentes
- Não alterar comportamento de sessões (adicionar campos é opcional)
- Não quebrar compatibilidade com o sistema OMC

**Ordem de Execução Recomendada:**
TODO 2 -> TODO 1 -> TODO 3 -> TODO 4 -> TODO 5 -> TODO 7 -> TODO 8

**Racional da Ordem:**
- **TODO 2 (sanitização):** Sanitizar project-memory.json PRIMEIRO (remover paths hardcoded)
- **TODO 1 (.gitignore + git rm):** Criar .gitignore E remover arquivos sensíveis do index SEGUNDO
- **TODO 3-5 (userscript):** Bugs funcionais independentes
- **TODO 7 (duplicata):** Remover linha duplicada no agent-replay.jsonl
- **TODO 8 (documentação):** Consistência - alinhar ordem de TODOs no plano existente

**NOTA sobre TODO 6:** REMOVIDO - Verificação confirmou que todos os arquivos JSON de sessão já possuem newline no EOF (`\n`/`0a`).

**Nota OMC:**
As alterações em `.omc/` são locais ao repositório e não afetam o funcionamento do sistema OMC. O `.gitignore` proposto segue as convenções do projeto.

---

## Categorização das Findings

### Categoria 1: Arquivos de Runtime no Git (potential_issue - 4 findings)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 1 | `.omc/state/last-tool-error.json` | Runtime state com PII/paths | Adicionar ao .gitignore + git rm --cached |
| 2 | `.omc/state/idle-notif-cooldown.json` | Runtime state | Adicionar ao .gitignore + git rm --cached |
| 3 | `.omc/state/hud-stdin-cache.json` | Sessão específica com paths | Adicionar ao .gitignore + git rm --cached |
| 4 | `.omc/state/agent-replay-*.jsonl` | Runtime replay + duplicação | Adicionar ao .gitignore + remover duplicata |

**Prioridade:** ALTA - Dados sensíveis expostos

### Categoria 2: Arquivos Sensíveis Específicos (potential_issue - 2 findings)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 5 | `repomix-output.xml` | Repo completo exportado | Adicionar ao .gitignore + git rm --cached |
| 6 | `.omc/project-memory.json` | Path hardcoded `/Users/gabrielramos/...` | Sanitizar + .gitignore |

**Prioridade:** ALTA - Dados sensíveis específicos

### Categoria 3: Bugs no Userscript (potential_issue - 1, nitpick - 2)

| # | Linhas | Problema | Ação |
|---|---------|----------|------|
| 7 | 148-153 | `hideTouchIndicator()` nunca chamado | Chamar em `onUp()` |
| 8 | 487-490 | Undo sem suporte a Mac Cmd key | Adicionar `e.metaKey` |
| 9 | 52-67 | `saveToHistory()` sem guarda zero-dim | Adicionar verificação `width/height === 0` |

**Prioridade:** MÉDIA - Bugs funcionais

### Categoria 4: Session Schema Issues (nitpick - 2 findings)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 10 | `.omc/sessions/58cbf5af...json` | Campo `reason` sem enum | Opcional: documentar enum |
| 11 | `.omc/sessions/58cbf5af...json` | Falta timestamp `created_at` | Opcional: adicionar campo |

**Prioridade:** BAIXA - Melhoria de schema, não quebra nada

### Categoria 5: JSON Newlines (nitpick - 0 findings)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 12 | `.omc/sessions/*.json` | **JÁ RESOLVIDO** - Todos os arquivos JSON de sessão já possuem newline no EOF | Nenhuma ação necessária |

**Prioridade:** N/A - Verificado via `cat -A` e `hexdump -C`

### Categoria 6: Normalização de Path (nitpick - 1 finding)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 15 | `.omc/project-memory.json` | Path vazio `""` deve ser `"."` | Normalizar para `"."` |

**Prioridade:** BAIXA - Consistência

### Categoria 7: Duplicação de Linha (nitpick - 1 finding)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 16 | `.omc/state/agent-replay-*.jsonl` | Linhas 12-13 são duplicatas idênticas | Remover uma das linhas |

**Prioridade:** BAIXA - Limpeza

### Categoria 8: Documentação Inconsistente (potential_issue - 1 finding)

| # | Arquivo | Problema | Ação |
|---|---------|----------|------|
| 17 | `.omc/plans/correcoes-criticas-v2.2.md` | Ordem TODO conflitante | Harmonizar ordem |

**Prioridade:** MÉDIA - Documentação confusa

---

## Fluxo de Trabalho

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: Segurança (.gitignore + saneamento)                    │
│  ├─ Sanitizar project-memory.json (PRIMEIRO)                    │
│  ├─ Criar .gitignore completo                                    │
│  └─ git rm --cached para remover arquivos sensíveis do index    │
│                                                                  │
│  FASE 2: Bugs do Userscript                                     │
│  ├─ hideTouchIndicator() call                                   │
│  ├─ Cmd key support para undo                                   │
│  └─ Zero-dimension guard em saveToHistory()                     │
│                                                                  │
│  FASE 3: Limpeza e Documentação                                 │
│  ├─ Remover duplicata no agent-replay                           │
│  └─ Corrigir ordem TODO no plano                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## TODOs Detalhados

### TODO 1: Criar .gitignore e Remover Arquivos Sensíveis

**Prioridade:** ALTA
**Complexidade:** BAIXA
**Arquivos:** .gitignore (novo), múltiplos arquivos para git rm --cached

**Problema:**
Arquivos de runtime e dados sensíveis estão committed no repositório.

**Solução (ordem crítica):**
1. **PRIMEIRO:** Sanitizar `project-memory.json` (ver TODO 2)
2. **SEGUNDO:** Criar `.gitignore` com os seguintes padrões:
   ```gitignore
   # OMC Runtime State
   .omc/state/
   .omc/state/**

   # OMC Project Memory (machine-specific)
   .omc/project-memory.json

   # Repomix Output
   repomix-output.xml

   # OMC Session Logs (optional - kept for audit)
   # .omc/sessions/
   ```
3. **TERCEIRO:** Remover arquivos do git index (preservando localmente):
   ```bash
   git rm --cached .omc/state/last-tool-error.json
   git rm --cached .omc/state/idle-notif-cooldown.json
   git rm --cached .omc/state/hud-stdin-cache.json
   git rm --cached .omc/state/agent-replay-91a31d1a-c2cb-482b-98b1-63884578b118.jsonl
   git rm --cached repomix-output.xml
   git rm --cached .omc/project-memory.json
   ```

**Critérios de Aceite:**
- [ ] `project-memory.json` foi sanitizado ANTES do git rm --cached
- [ ] `.gitignore` criado com todos os padrões
- [ ] `git status` mostra arquivos como "deleted" (não "untracked")
- [ ] Arquivos ainda existem localmente (não foram deletados do disco)
- [ ] Commit subsequente incluirá a versão sanitizada de project-memory.json

**Risco:** BAIXO - Operação padrão de git rm --cached

**Rollback:**
```bash
git reset HEAD .omc/state/ repomix-output.xml .omc/project-memory.json
```

---

### TODO 2: Sanitizar project-memory.json

**Prioridade:** ALTA
**Complexidade:** BAIXA
**Arquivo:** `.omc/project-memory.json`

**PROIBIDO:** Executar git rm --cached ANTES de sanitizar este arquivo.

**Problema:**
- Linha 4: `projectRoot` contém path absoluto `/Users/gabrielramos/TecTools`
- Linhas 39-44: `path: ""` para diretório raiz (deveria ser ".")

**Solução:**
Sanitizar **ANTES de qualquer operação git**:

```diff
-   "projectRoot": "/Users/gabrielramos/TecTools",
+   "projectRoot": ".",
```

E para hotPaths:
```diff
     {
-      "path": "",
+      "path": ".",
       "accessCount": 1,
       "lastAccessed": 1772679962439,
       "type": "directory"
     }
```

**Critérios de Aceite:**
- [ ] `projectRoot` usa caminho relativo `"."`
- [ ] hotPaths usa `"."` em vez de `""`
- [ ] Arquivo funciona para outros usuários/máquinas
- [ ] A versão sanitizada será commitada (não a versão com paths hardcoded)

**Risco:** BAIXO - Path relativo é mais portável

**Ordem Crítica:**
1. Sanitizar project-memory.json (ESTE TODO)
2. Criar .gitignore (TODO 1)
3. git add .gitignore project-memory.json
4. git rm --cached para outros arquivos
5. Fazer commit único

---

### TODO 3: Corrigir hideTouchIndicator() Nunca Chamado

**Prioridade:** MÉDIA
**Complexidade:** BAIXA
**Arquivo:** `tecconcursos-desenho.user.js`
**Linhas:** 148-153 (definição), 432-442 (handler onUp)

**Problema:**
A função `hideTouchIndicator()` está definida mas nunca é invocada. O indicador visual de touch nunca é escondido.

**Solução:**
Adicionar a chamada no handler `onUp()` (linhas 432-442), especificamente **APÓS a linha 435**:

```javascript
function onUp() {
    if (isDrawing) {
        ctx.closePath();
        isDrawing = false;           // LINHA 435
        hideTouchIndicator();        // ADICIONAR ESTA CHAMADA AQUI
        saveToHistory();
        // Salvar no localStorage se habilitado
        if (document.getElementById('tcc-persist')?.checked) {
            saveToLocalStorage();
        }
    }
}
```

**Critérios de Aceite:**
- [ ] `hideTouchIndicator()` é chamado quando touch termina (após linha 435)
- [ ] Indicador desaparece visualmente (opacity: 0)
- [ ] Guarda `if (touchIndicator)` é mantida (lazy init)
- [ ] Nenhuma regressão em touch existente

**Teste:**
1. Ativar modo desenho
2. Fazer um traço com touch
3. Soltar o dedo
4. Verificar que indicador desaparece

---

### TODO 4: Adicionar Suporte a Cmd Key (Mac) no Undo

**Prioridade:** MÉDIA
**Complexidade:** BAIXA
**Arquivo:** `tecconcursos-desenho.user.js`
**Linhas:** 487-490

**Problema:**
```javascript
} else if (e.ctrlKey && e.key === 'z') {
```
Usuários de Mac usam Cmd (metaKey), não Ctrl.

**Solução:**
```diff
- } else if (e.ctrlKey && e.key === 'z') {
+ } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
  }
```

**Critérios de Aceite:**
- [ ] Cmd+Z funciona no Mac
- [ ] Ctrl+Z continua funcionando no Windows/Linux
- [ ] `z` e `Z` funcionam (case insensitive)

**Teste:**
- Mac: Cmd+Z deve desfazer
- Windows/Linux: Ctrl+Z deve desfazer

---

### TODO 5: Guard Against Zero-Dimensions em saveToHistory()

**Prioridade:** MÉDIA
**Complexidade:** BAIXA
**Arquivo:** `tecconcursos-desenho.user.js`
**Linhas:** 52-67

**Problema:**
```javascript
function saveToHistory() {
    if (!canvas) return;
    // ...
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
```
Se `canvas.width === 0` ou `canvas.height === 0`, `getImageData` pode falhar ou retornar dados inválidos.

**Solução:**
```diff
 function saveToHistory() {
-    if (!canvas) return;
+    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

     // Remover estados futuros se estamos no meio do histórico
     if (historyStep < history.length - 1) {
```

**Critérios de Aceite:**
- [ ] Verificação de zero-dimensions adicionada
- [ ] `getImageData` nunca é chamado com dimensões zero
- [ ] Botão undo continua funcionando normalmente

---

### TODO 6: [REMOVIDO] - Newlines em Arquivos JSON

**Status:** NÃO APLICÁVEL - Já resolvido

**Verificação:**
Todos os arquivos JSON de sessão já possuem newline no EOF:
- `.omc/sessions/58cbf5af-c021-4cc6-897b-94835c96865c.json` - Possui `\n` (hexdump mostra `0a`)
- `.omc/sessions/91a31d1a-c2cb-482b-98b1-63884578b118.json` - Possui `\n` (cat -A mostra `␊`)
- `.omc/sessions/b7ba7ce1-8d48-4cf1-bf49-c8ee8e3fc2d9.json` - Possui `\n` (cat -A mostra `␊`)

**Ação:** Nenhuma necessária

---

### TODO 7: Remover Linha Duplicada no agent-replay

**Prioridade:** BAIXA
**Complexidade:** BAIXA
**Arquivo:** `.omc/state/agent-replay-91a31d1a-c2cb-482b-98b1-63884578b118.jsonl`

**Problema:**
Linhas 12-13 são idênticas:
```
{"t":0,"agent":"system","event":"keyword_detected","keyword":"ralplan"}
{"t":0,"agent":"system","event":"keyword_detected","keyword":"ralplan"}
```

**Solução:**
Remover a linha 13 (manter apenas a linha 12).

**Critérios de Aceite:**
- [ ] Apenas uma linha com "keyword_detected", "keyword":"ralplan"
- [ ] Arquivo .jsonl permanece válido (um JSON por linha)

**Nota:** Este arquivo será removido do git via TODO 1, mas a limpeza é útil para evitar futuros commits acidentais.

---

### TODO 8: Corrigir Inconsistência de Ordem no Plano

**Prioridade:** MÉDIA
**Complexidade:** BAIXA
**Arquivo:** `.omc/plans/correcoes-criticas-v2.2.md`

**Problema:**
O plano `correcoes-criticas-v2.2.md` pode ter referências inconsistentes à ordem de execução.

**Solução:**
Verificar e harmonizar todas as referências de ordem em `correcoes-criticas-v2.2.md` para seguir a ordem correta estabelecida:
- **TODO 2 (sanitização)** deve vir PRIMEIRO
- **TODO 1 (.gitignore + git rm)** deve vir SEGUNDO

**Nota:** A ordem correta (TODO 2 → TODO 1) foi estabelecida após revisão do Architect, pois sanitização deve ocorrer ANTES do git rm --cached para que a versão sanitizada seja commitada, não a versão com paths hardcoded.

**Critérios de Aceite:**
- [ ] Todas as referências de ordem em `correcoes-criticas-v2.2.md` mostram TODO 2 → TODO 1
- [ ] Seções de "Ordem recomendada" ou "Racional" refletem a ordem correta
- [ ] Notas explicativas mencionam "sanitizar PRIMEIRO, depois git rm --cached"

---

### TODO 9 (Opcional): Melhorias de Schema em Sessões

**Prioridade:** BAIXA
**Complexidade:** MÉDIA (altera schema OMC)
**Arquivo:** `.omc/sessions/58cbf5af-c021-4cc6-897b-94835c96865c.json`

**Problemas:**
1. Campo `reason` usa literal "prompt_input_exit" sem enum documentado
2. Falta campo `created_at` ou `started_at`

**Solução (Opcional):**
Esta finding é sobre o schema do sistema OMC, não deste projeto específico.
**Decisão:** MANTER COMO ESTÁ - documentar na seção Open Questions.

Justificativa: Alterar o schema de sessão pode quebrar compatibilidade com OMC.

**Critérios de Aceite (se implementado):**
- [ ] Enum `SessionEndReason` documentado em algum lugar
- [ ] Campo `created_at` adicionado com timestamp ISO8601

---

## Critérios de Sucesso Globais

- [ ] Todos os 16 findings foram endereçados (9 implementados, 7 documentados/opcionais)
- [ ] Nenhum arquivo sensível permanece no git index
- [ ] `.gitignore` previne futuros commits acidentais
- [ ] Bugs do userscript foram corrigidos
- [ ] Testes manuais passam (userscript funcional)
- [ ] Nenhuma regressão introduzida

---

## Estratégia de Testes

### Teste 1: Segurança (.gitignore)
```bash
# Após sanitizar, criar .gitignore e git rm --cached
git status
# Esperado: arquivos .omc/state/, repomix-output.xml como "deleted"
# Esperado: project-memory.json como "modified" (versão sanitizada)
# Esperado: novos arquivos nessas pastas como "untracked"

# Criar arquivo novo em .omc/state/
echo '{"test": true}' > .omc/state/test.json
git status
# Esperado: test.json NÃO aparece como untracked
```

### Teste 2: Userscript - Touch Indicator
1. Instalar script modificado no Tampermonkey
2. Navegar para uma questão do TecConcursos
3. Ativar modo desenho
4. Fazer traço com touch (celular ou emulador)
5. Soltar
6. **Verificar:** Indicador desaparece (opacity: 0)

### Teste 3: Userscript - Cmd Key
1. Ativar modo desenho
2. Fazer traço
3. Pressionar Cmd+Z (Mac) ou Ctrl+Z (Windows)
4. **Verificar:** Traço é desfeito em ambos os casos

### Teste 4: Userscript - Zero Dimensions
1. Ativar modo desenho
2. Fazer traços
3. Verificar console para erros
4. **Verificar:** Nenhum erro relacionado a getImageData

---

## Versão e Release

**Versionamento:**
- Userscript: v2.2 -> v2.3 (MINOR, novo suporte Mac + bugfixes)
- Commit: unico commit com todas as correções

**Commit message sugerido:**
```
Fix: corrigir 16 findings do CodeRabbit

Segurança:
- Adicionar .gitignore para .omc/state/, repomix-output.xml, project-memory.json
- Remover arquivos de runtime do git index
- Sanitizar path hardcoded em project-memory.json

Userscript (tecconcursos-desenho.user.js v2.3):
- Adicionar chamada a hideTouchIndicator() no handler onUp (linha 435+)
- Suportar Cmd+Z (Mac) para undo, além de Ctrl+Z
- Guard against zero-dimensions em saveToHistory()

Limpeza:
- Remover linha duplicada em agent-replay.jsonl
- Harmonizar ordem de TODOs no plano correcoes-criticas-v2.2.md

Nota: Newlines em JSON de sessão já estavam presentes (não aplicável).
```

---

## Notas de Implementação

### Ordem de Execução Recomendada

1. **TODO 2 (sanitização)** - PRIMEIRO: Sanitizar project-memory.json
2. **TODO 1 (.gitignore)** - SEGUNDO: Criar .gitignore E git rm --cached
3. **TODO 3, 4, 5 (userscript)** - Bugs funcionais
4. **TODO 7 (duplicata)** - Remover linha duplicada
5. **TODO 8 (documentação)** - Consistência

### Sequência Segura de Saneamento

A ordem segura para TODO 1 e TODO 2 é:
1. **Sanitizar `project-memory.json`** (remover paths hardcoded)
2. Criar/editar `.gitignore` com os padrões apropriados
3. `git add .gitignore project-memory.json` (adiciona versão sanitizada)
4. `git rm --cached` para outros arquivos sensíveis
5. Fazer **único commit** com todas as correções

**NOTA CRÍTICA:** Se `git rm --cached` for executado ANTES de sanitizar `project-memory.json`, a versão commitada será a com paths hardcoded. A sanitização deve ocorrer PRIMEIRO.

### Dependências

- TODO 2 deve ser ANTES de TODO 1 (sanitizar antes de git rm --cached)
- TODO 1 deve ser antes de qualquer commit (para prevenir re-commit acidental)
- TODOs 3-5 são independentes entre si
- TODO 7-8 podem ser feitos a qualquer momento

### Impacto OMC

As alterações em `.omc/` são locais ao repositório e **não afetam o funcionamento do sistema OMC**. O `.gitignore` proposto segue as convenções do projeto e apenas previne que arquivos de runtime sejam commitados.

### Risco Total: BAIXO

Todas as alterações são:
- Localizadas (arquivos específicos)
- Não-breaking (melhorias, não mudanças de API)
- Reversíveis (git reset para rollback)

---

## Open Questions

### Session Schema (TODO 9)
**Questão:** Devemos implementar as melhorias de schema nas sessões (enum para `reason`, campo `created_at`)?

**Opções:**
1. **Ignorar** - Schema é do sistema OMC, não do projeto
2. **Documentar** - Adicionar comentário no arquivo explicando
3. **Implementar** - Alterar schema e documentar em .omc/

**Decisão:** Ignorar por agora, pois envolve modificar o sistema OMC que gere as sessões. Documentar em `.omc/plans/open-questions.md`.

---

## Histórico de Revisões

| Data | Versão | Alteração | Autor |
|------|--------|-----------|-------|
| 2026-03-05 | 1.0 | Plano inicial criado | Planner |
| | | - Análise das 16 findings do CodeRabbit | |
| | | - Categorização por prioridade | |
| | | - 9 TODOs detalhados (8 implementáveis, 1 opcional) | |
| 2026-03-05 | 1.1 | Correções documentais do Architect | Planner |
| | | - Harmonizada ordem de TODOs (TODO 1 -> TODO 2 -> TODO 3...) | |
| | | - Adicionada nota de impacto OMC nos Guardrails | |
| | | - Clarificada sequência de saneamento vs git rm --cached | |
| 2026-03-05 | 1.2 | Iteração do Architect - resolução de inconsistências | Planner |
| | | - Resolvida contradição de commits (único commit atomico) | |
| | | - Removida ambiguidade "ou após" do TODO 2 | |
| | | - Completado racional da ordem com explicação do TODO 8 | |
| 2026-03-05 | 1.3 | Iteração do Critic - correção de 5 issues verificadas | Planner |
| | | - [CRITICAL] TODO 6 REMOVIDO: newlines já existem em todos JSON | |
| | | - [HIGH] TODO 7 validado: duplicata confirmada em linhas 12-13 | |
| | | - [HIGH] TODO 3 corrigido: handler onUp nas linhas 432-442, inserir após linha 435 | |
| | | - [MEDIUM] TODO 1-2 reordenados: sanitizar ANTES de git rm --cached | |
| | | - [LOW] TODO 8 especificado: linha 59 alterada, linha 366 já correta | |
| 2026-03-05 | 1.4 | Iteração do Architect - correção de inconsistência de ordem de execução | Planner |
| | | - [CRITICAL] Linha 44 corrigida: ordem agora mostra TODO 2 -> TODO 1 -> ... | |
| | | - [CRITICAL] Linhas 47-48 corrigidas: racional agora reflete TODO 2 PRIMEIRO | |
| | | - [VERIFIED] Consistência verificada em todas as seções do documento | |

---

## Próximos Passos

1. **Aprovação do plano** pelo usuário
2. **Execução** via `/oh-my-claudecode:start-work coderabbit-16-findings`
3. **Verificação** via testes manuais
4. **Commit** com todas as correções

---

**Plano pronto para execução em 2026-03-05**
