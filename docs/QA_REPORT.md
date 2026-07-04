# 🧪 Relatório de QA — BeautyFlow (Revisão Funcional Completa)

> **Revisor:** QA Pleno  
> **Data:** Julho 2026  
> **Versão analisada:** Spec v0.3

---

## Legenda de Severidade

| Ícone | Severidade | Descrição |
|---|---|---|
| 🔴 | Crítica | Bloqueador de produção — não pode ir ao ar |
| 🟠 | Alta | Dívida técnica prioritária |
| 🟡 | Média | Importante, mas não bloqueia MVP |
| 🟢 | Baixa | Melhoria / documentação |

---

## Módulo 1 — Agendamento (Scheduling)

| # | Problema | Cenário de Teste | Severidade | Status |
|---|---|---|---|---|
| 1.1 | Race condition em createBooking (check-then-act sem lock) | Promise.all com 2 requisições simultâneas para mesmo slot | 🔴 Crítica | ✅ Resolvido |
| 1.2 | getAvailability ignora service.durationMinutes | Serviço 90min gera slots sobrepostos | 🔴 Crítica | ✅ Resolvido |
| 1.3 | Aceita agendamento no passado | Cliente manda horário de ontem | 🟠 Alta | 📋 Backlog |
| 1.4 | Sem antecedência mínima/máxima | Agendar daqui 2min ou para 2030 | 🟡 Média | 📋 Backlog |
| 1.5 | Timezone sem aplicação no cálculo de slots | Salão em fuso diferente do servidor | 🔴 Crítica | ✅ Resolvido |
| 1.6 | Sem feriados/bloqueios pontuais | Profissional de folga aparece disponível | 🟠 Alta | 📋 Sprint 3-4 |
| 1.7 | dayOfWeek sem timezone → erro perto da meia-noite | Agendamento às 23h50 em fuso diferente | 🟠 Alta | ✅ Resolvido (via 1.5) |
| 1.8 | Cancelamento não libera slot nem cobra no-show | Cliente cancela → slot some? | 🟠 Alta | 📋 Sprint 3-4 |
| 1.9 | Sem fluxo de reagendamento | "Pode mudar pra sexta?" | 🟡 Média | 📋 Sprint 3-4 |
| 1.10 | Mesmo cliente em dois serviços simultâneos com profissionais diferentes | Cabelo 14h prof A + manicure 14h prof B | 🟢 Baixa | 📋 Backlog |

---

## Módulo 2 — IA / Orquestrador

| # | Problema | Cenário de Teste | Severidade | Status |
|---|---|---|---|---|
| 2.1 | Loop de tool calls quebra na primeira iteração | Mensagem com 2 intents simultâneos | 🔴 Crítica | ✅ Resolvido |
| 2.2 | Sem timeout/fallback se OpenAI > 20s | Latência simulada de 25s | 🔴 Crítica | ✅ Resolvido |
| 2.3 | Sem sanitização contra prompt injection | "Ignore instruções anteriores..." | 🟠 Alta | 📋 Sprint 9-10 |
| 2.4 | Histórico de conversa sem limite de tokens | Cliente com 500 mensagens | 🟠 Alta | 📋 Sprint 9-10 |
| 2.5 | Transcrição de áudio sem tratamento de limite/idioma/falha | Áudio de 30min ou em espanhol | 🟡 Média | 📋 Backlog |
| 2.6 | Sem tratamento para mensagens fora de escopo | Imagem, emoji, pergunta não relacionada | 🟡 Média | 📋 Backlog |
| 2.7 | Enum de serviços fixo ['cabelo','barba','manicure'] | Salão oferece "depilação" | 🟠 Alta | 📋 Sprint 1-2 |
| 2.8 | Sem rate limiting por cliente na camada de IA | 50 mensagens em 10 segundos | 🟠 Alta | 📋 Sprint 9-10 |
| 2.9 | IA pode agendar sem confirmação explícita do cliente | "Acho que quero corte" dispara booking | 🟠 Alta | ✅ Resolvido |

---

## Módulo 3 — Billing / Split

| # | Problema | Cenário de Teste | Severidade | Status |
|---|---|---|---|---|
| 3.1 | Webhook sem idempotência | Mesmo payload enviado 2x | 🔴 Crítica | ✅ Resolvido |
| 3.2 | Sem validação de assinatura do webhook Asaas | Payload forjado direto ao endpoint | 🔴 Crítica | ✅ Resolvido |
| 3.3 | Comissão fixa por profissional (não varia por serviço) | 60% corte, 40% coloração | 🟠 Alta | 📋 Sprint 7-8 |
| 3.4 | Percentuais de split sem validação de soma = 100% | Soma manualmente alterada > 100% | 🟠 Alta | 📋 Sprint 7-8 |
| 3.5 | Sem tratamento de reembolso parcial | Cliente pede reembolso após split pago | 🟠 Alta | 📋 Sprint 7-8 |
| 3.6 | Booking + crédito não-atômicos | Falha de rede entre criar booking e creditar | 🔴 Crítica | ✅ Resolvido |
| 3.7 | Fluxo de cobrança avulsa ambíguo | Cliente sem plano pagando por PIX | 🟡 Média | 📋 Backlog |
| 3.8 | Bloqueio por inadimplência inexistente | Assinatura PAST_DUE agenda livremente | 🔴 Crítica | ✅ Resolvido |
| 3.9 | Moeda implícita sem campo | N/A | 🟢 Baixa | ✅ Documentado (BRL default) |

---

## Módulo 4 — Canal WhatsApp

| # | Problema | Cenário de Teste | Severidade | Status |
|---|---|---|---|---|
| 4.1 | Sem validação de assinatura Meta (X-Hub-Signature-256) | Payload manual sem header | 🔴 Crítica | ✅ Resolvido |
| 4.2 | entry[0] sem checagem de existência | Enviar {} ou {"entry":[]} | 🟠 Alta | ✅ Resolvido |
| 4.3 | Sem deduplicação de mensagens Meta | Meta reenvia em timeout > 20s | 🟠 Alta | 📋 Sprint 1-2 |
| 4.4 | Sem suporte a imagem/localização/sticker | Cliente manda foto de referência | 🟡 Média | 📋 Backlog |
| 4.5 | Sem opt-out/LGPD | "Para de me mandar mensagem" | 🟠 Alta | 📋 Sprint 9-10 |
| 4.6 | Janela 24h Meta não tratada | Lembrete >24h após última interação | 🔴 Crítica | ✅ Resolvido |

---

## Módulo 5 — Segurança / Autenticação

| # | Problema | Severidade | Status |
|---|---|---|---|
| 5.1 | Multi-tenancy não reforçada nas queries | 🔴 Crítica | ✅ Resolvido |
| 5.2 | CPF/CNPJ em texto puro | 🟠 Alta | 📋 Sprint 9-10 |
| 5.3 | RBAC sem granularidade por papel | 🟠 Alta | 📋 Sprint 9-10 |
| 5.4 | Sem rate limiting geral na API | 🟡 Média | 📋 Sprint 9-10 |
| 5.5 | Secrets sem gestão (Vault/AWS Secrets Manager) | 🟢 Baixa | 📋 Backlog |

---

## Módulo 6 — Dados / LGPD

| # | Problema | Severidade | Status |
|---|---|---|---|
| 6.1 | Sem política de retenção de histórico de conversa | 🟠 Alta | 📋 Sprint 9-10 |
| 6.2 | Sem endpoint de exclusão/anonimização | 🟠 Alta | 📋 Sprint 9-10 |
| 6.3 | Sem base legal para dados sensíveis (ex: alergias) | 🟡 Média | 📋 Backlog |

---

## Módulo 7 — Observabilidade

| # | Problema | Severidade | Status |
|---|---|---|---|
| 7.1 | Sem plano de alertas (Sentry/Grafana) | 🟡 Média | 📋 Sprint 11-12 |
| 7.2 | Sem circuit breaker/retry para chamadas externas | 🟠 Alta | 📋 Sprint 11-12 |
| 7.3 | Sem plano de teste de carga | 🟡 Média | 📋 Sprint 11-12 |

---

## ✅ Resumo — Bloqueadores Críticos

| # | Bloqueador | Solução Aplicada |
|---|---|---|
| 1.1 | Double-booking | SELECT FOR UPDATE NOWAIT + Serializable transaction |
| 1.2 | Slots ignoram durationMinutes | Loop com avanço dinâmico por durationMs |
| 1.5 | Timezone sem aplicação | date-fns-tz fromZonedTime/toZonedTime |
| 2.1 | Loop de tool calls quebrado | Agentic loop while + Promise.all |
| 2.2 | Timeout OpenAI | AbortController 19s + fallback + background |
| 3.1/3.2 | Idempotência + assinatura webhook | Redis SET NX + validação token Asaas |
| 3.6 | Booking + crédito não-atômicos | $transaction com UPDATE condicional |
| 3.8 | Inadimplência não bloqueia agenda | Guard no createBooking + check na tool call |
| 4.1 | Assinatura Meta não validada | HMAC-SHA256 timingSafeEqual |
| 4.6 | Janela 24h não tratada | Detecção de janela + template aprovado Meta |
| 5.1 | Multi-tenancy nas queries | withTenant() helper + TenantMiddleware |
