# Gemini Context: TecTools

Este é um projeto de **Userscript** projetado para injetar ferramentas de desenho livre e anotações sobre questões no site [Tec Concursos](https://www.tecconcursos.com.br/).

## 🚀 Quick Start

1. **Requisitos**: 
   - Navegador (Chrome, Firefox ou Edge).
   - Gerenciador de Scripts ([Tampermonkey](https://www.tampermonkey.net/) v4.19+ ou [Violentmonkey](https://violentmonkey.github.io/)).
2. **Instalação**: 
   - Clique em "Criar novo script" no seu gerenciador.
   - Cole o conteúdo de [tecconcursos-desenho.user.js](./tecconcursos-desenho.user.js).
   - Salve e acesse qualquer questão no site.
3. **Desenvolvimento**:
   - `npm install` para configurar o ambiente de testes.
   - `npm test` para rodar a suíte E2E.

## Visão Geral do Projeto

- **Objetivo**: Proporcionar uma camada de desenho (canvas) sobre o enunciado das questões para facilitar o estudo.
- **Tecnologias**: JavaScript (Vanilla), HTML5 Canvas API, Playwright (E2E).
- **Arquitetura**: Injeção dinâmica via IIFE com `MutationObserver` para suporte a SPA.

## Fluxo de Trabalho

- **Versionamento**: Atualize o campo `@version` em `tecconcursos-desenho.user.js` antes de releases.
- **Commits**: Use prefixos padronizados com mensagens claras:
  - `Feat: adicionar suporte a múltiplas cores no pincel`
  - `Fix: corrigir cálculo de opacidade no canvas`
  - `Upgrade: refatorar função de histórico para melhor performance`
  - `Release: publicar v2.3.0`

## Convenções de Desenvolvimento

- **Configurações**: Edite o objeto `CFG` no topo do script para mudar cores, espessura ou seletores CSS.
- **Documentação**: Veja o [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) para detalhes técnicos profundos.

## TODO / Futuro
- [ ] Implementar sistema de exportação de desenhos como imagem.
- [ ] Adicionar suporte a múltiplos pincéis/cores selecionáveis na UI.
