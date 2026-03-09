# Open Questions

Este arquivo registra perguntas não resolvidas e decisões pendentes que surgiram durante o planejamento.

---

## [coderabbit-16-findings] - 2026-03-05

- [x] **Session Schema improvements** (DECIDIDO: ignorar) - As sessões do OMC (`.omc/sessions/*.json`) poderiam ter:
  - Enum documentado para o campo `reason` (ex: "prompt_input_exit", "timeout", "error", "user_logout")
  - Campo `created_at` ou `started_at` além do `ended_at` existente

  **Por que importa:** Melhoraria consistência e permitiria calcular duração das sessões.

  **Decisão:** Ignorar por agora - o schema é definido pelo sistema OMC, não pelo projeto. Alterar pode quebrar compatibilidade. Se implementado, deve ser no nível do sistema OMC, não neste projeto específico.

---
