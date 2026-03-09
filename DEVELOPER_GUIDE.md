# Developer Guide — TecConcursos Desenho Livre

> Userscript para desenho livre sobre questões em tecconcursos.com.br

---

## 1. Configuração

### Pré-requisitos

| Ferramenta | Finalidade |
|---|---|
| Navegador (Chrome/Firefox) | Execução do userscript |
| [Tampermonkey](https://www.tampermonkey.net/) ou [Violentmonkey](https://violentmonkey.github.io/) | Gerenciador de userscripts |
| Git | Controle de versão |

### Instalação

```bash
# 1. Clone o repositório
git clone <repo-url>
cd TecTools

# 2. Instale o script no Tampermonkey
# Abra o painel do Tampermonkey → "Criar novo script"
# Cole o conteúdo de tecconcursos-desenho.user.js
# Salve (Ctrl+S)

# 3. Acesse qualquer questão no TecConcursos para testar
# https://www.tecconcursos.com.br/questoes/
```

### Configurações do script (`CFG`)

Edite o bloco `CFG` no topo de `tecconcursos-desenho.user.js` para personalizar:

```js
const CFG = {
    strokeColor: 'rgba(220, 50, 50, 0.72)', // cor do traço
    lineWidth: 4,                            // espessura (px)
    zIndex: 99998,                           // camada do canvas
    maxHistory: 20,                          // máx. estados de undo
    selArticle: 'article.questao-enunciado', // seletor do artigo
    selIdInput: '.questao-rg-area-coluna-1 input[type="hidden"]', // seletor do ID da questão
};
```

---

## 2. Estrutura do Projeto

```
TecTools/
├── tecconcursos-desenho.user.js   # Script principal (único arquivo de produção)
├── DEVELOPER_GUIDE.md             # Este guia
├── analisecoderabbit_debug.md     # Análise de revisões do CodeRabbit
├── .gitignore
└── .omc/                          # Metadados internos do OMC (não edite manualmente)
    ├── plans/                     # Planos e decisões arquitetais
    │   ├── coderabbit-16-findings.md
    │   ├── correcoes-criticas-v2.2.md
    │   └── open-questions.md
    └── sessions/                  # Sessões de trabalho (ignoradas pelo git)
```

### Arquitetura do script

O script é um IIFE (`(function() { ... })()`) com seções bem delimitadas:

```
CFG                   → Configurações centralizadas
Estado interno        → Variáveis globais (canvas, ctx, observer, etc.)
Utilitários           → getArticle(), getQId()
Canvas                → createCanvas(), positionCanvas(), resizeCanvas()
Painel UI             → createPanel() + botões (toggle, undo, clear, cor, espessura, borracha, persist)
Eventos de desenho    → touch + mouse (pointerdown, pointermove, pointerup)
Histórico (undo)      → saveState(), undo()
Persistência          → saveToLocalStorage(), loadFromLocalStorage()
Resize                → listener passivo com debounce
Observer              → setupObserver() — detecta troca de questão via MutationObserver
```

---

## 3. Fluxo de Trabalho de Desenvolvimento

### Branches

```
main                        # Versão estável liberada
feature/desenhos-melhorias  # Branch ativa de desenvolvimento
```

### Ciclo de mudança

```bash
# 1. Trabalhe na branch de feature
git checkout feature/desenhos-melhorias

# 2. Edite tecconcursos-desenho.user.js
# (O Tampermonkey pode recarregar o arquivo automaticamente se apontar para o disco)

# 3. Bumpe a versão no cabeçalho @version antes de commitar
# Siga: patch (x.x.N) para bugfix, minor (x.N.0) para feature

# 4. Commit com mensagem descritiva
git add tecconcursos-desenho.user.js
git commit -m "Fix: descrição curta da correção"

# 5. Push
git push origin feature/desenhos-melhorias
```

### Convenção de commits

| Prefixo | Quando usar |
|---|---|
| `Feat:` | Nova funcionalidade |
| `Fix:` | Correção de bug |
| `Upgrade:` | Melhoria sem nova feature |
| `Release:` | Versão liberada |

### Atualizando a versão

Edite as duas linhas em `tecconcursos-desenho.user.js`:

```js
// @version      2.3          ← cabeçalho do userscript
// @description  ... v2.3: ...  ← descrição resumida
```

---

## 4. Abordagem de Teste

O script não possui suite de testes automatizados (sem build step). O teste é **manual e exploratório** no browser.

### Checklist antes de cada PR

| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Abrir uma questão | Painel flutuante aparece no canto inferior direito |
| 2 | Clicar "Desenho ON" | Canvas ativo, cursor muda para crosshair |
| 3 | Desenhar com mouse | Traço visível na cor/espessura configurada |
| 4 | Desenhar com toque (mobile/tablet) | Traço visível, scroll da página não interfere |
| 5 | Clicar "Desfazer" | Último traço removido (máx. 20 estados) |
| 6 | Clicar "Limpar" | Canvas completamente limpo |
| 7 | Trocar de questão (SPA nav) | Canvas reinicia, observer detecta nova questão |
| 8 | Ativar "Persistir" e trocar de questão | Desenho carregado do localStorage na nova sessão |
| 9 | Redimensionar janela | Canvas redimensiona e reposiciona sobre o artigo |
| 10 | Modo borracha | Apaga traços sem alterar o fundo |

### Onde testar

- `https://www.tecconcursos.com.br/questoes/cadernos/*` — modo caderno
- `https://www.tecconcursos.com.br/questoes/*` — questão individual

### DevTools úteis

```js
// Verificar se o canvas foi criado
document.querySelector('#tcc-canvas')

// Inspecionar estado do observer no console (adicione temporariamente)
console.log('QID:', getQId())
```

---

## 5. Solução de Problemas

### Painel não aparece na página

**Causa provável:** seletor CSS desatualizado — o site mudou a estrutura HTML.

```js
// Verifique no console do browser:
document.querySelector('article.questao-enunciado')
// Se retornar null → atualize CFG.selArticle
```

### Canvas não acompanha o scroll / posição errada

**Causa provável:** `positionCanvas()` não está encontrando o artigo ou o layout mudou.

1. Abra DevTools → inspecione `#tcc-canvas`
2. Compare `getBoundingClientRect()` do canvas com o do artigo
3. Ajuste a lógica em `positionCanvas()` se necessário

### Observer não detecta troca de questão

**Causa provável:** seletor do input hidden mudou.

```js
// Teste no console:
document.querySelector('.questao-rg-area-coluna-1 input[type="hidden"]')?.value
// Se null → atualize CFG.selIdInput
```

### Desenho não persiste entre questões

1. Verifique se "Persistir" está marcado no painel
2. Confirme que `localStorage` não está bloqueado (modo privativo pode bloquear)
3. Inspecione no DevTools → Application → Local Storage → chave `tcc-canvas-<questaoId>`

### Script não carrega (Tampermonkey)

1. Confirme que o `@match` bate com a URL atual
2. Verifique no painel do Tampermonkey se o script está **ativado**
3. Recarregue a página com `Ctrl+Shift+R` (hard reload, ignora cache)

### Conflito com extensões de acessibilidade ou ad-blockers

O script usa `z-index: 99998`. Se outro elemento estiver na frente:

```js
// Ajuste no CFG:
zIndex: 999999
```

---

## Histórico de versões

| Versão | Destaque |
|---|---|
| v2.2 | 3 correções críticas (CodeRabbit); observer fix |
| v2.1 | 5 novas features (borracha, persistência, touch) |
| v2.0 | 8 melhorias críticas de estabilidade |
| v1.x | Versão inicial com desenho básico |
