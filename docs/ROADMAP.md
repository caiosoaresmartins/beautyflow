# 📅 Roadmap de Desenvolvimento — BeautyFlow

## Visão Geral

```
Sprint 1-2   → MVP IA de agendamento via WhatsApp
Sprint 3-4   → Dashboard multi-profissional
Sprint 5-6   → Planos e recorrência
Sprint 7-8   → Split automático e relatórios
Sprint 9-10  → Antecipação, RBAC e LGPD
Sprint 11-12 → Multi-salão, circuit breakers, testes de carga
```

---

## Sprint 1-2 — MVP: IA de Agendamento

**Objetivo:** Um cliente consegue agendar via WhatsApp em texto livre.

### Entregas
- [ ] Integração WhatsApp Business Cloud API (webhooks + envio)
- [ ] Validação de assinatura Meta (X-Hub-Signature-256)
- [ ] AI Orchestrator com agentic loop completo (multi tool calls)
- [ ] Timeout 19s + fallback + processamento em background
- [ ] `check_availability` com timezone real (`date-fns-tz`)
- [ ] `create_booking` com `SELECT FOR UPDATE NOWAIT`
- [ ] Lembretes automáticos com lógica de janela 24h
- [ ] Deduplicação de mensagens duplicadas do Meta
- [ ] Schema inicial (Salon, Professional, WorkingHours, Service, Booking, Client)

**Critério de aceite:** Barbearia piloto consegue receber agendamentos 24h sem intervenção humana.

---

## Sprint 3-4 — Dashboard Multi-Profissional

**Objetivo:** Dono do salão gerencia agenda, profissionais e serviços.

### Entregas
- [ ] API RESTful com JWT + TenantMiddleware (multi-tenancy)
- [ ] CRUD de Profissionais, Serviços, WorkingHours
- [ ] LeaveBlocks e SalonHolidays
- [ ] Visualização calendário/timeline por profissional
- [ ] KPIs: taxa de ocupação, receita, no-shows
- [ ] Reagendamento (rescheduledFrom + liberação de slot)

---

## Sprint 5-6 — Planos e Recorrência

**Objetivo:** Clube da Barba / Planos mensais funcionando end-to-end.

### Entregas
- [ ] Models Plan, Subscription, SubscriptionCredits
- [ ] Integração Asaas: criação de plano + assinatura + webhook
- [ ] Idempotência de webhooks (Redis SET NX)
- [ ] Validação assinatura webhook Asaas
- [ ] Bloqueio de agenda por inadimplência (PAST_DUE)
- [ ] Transação atômica booking + decremento de crédito
- [ ] Tool calls na IA: `check_subscription_status`, `create_subscription`, `get_payment_link`

---

## Sprint 7-8 — Split Automático e Relatórios

**Objetivo:** Repasse automático de comissões direto no gateway.

### Entregas
- [ ] CommissionRule por profissional e por serviço
- [ ] Validação: professionalPct + salonPct + platformPct = 100%
- [ ] ChargeSplit gerado em toda cobrança (avulsa e recorrente)
- [ ] Estorno com reversão proporcional de split
- [ ] Relatório de repasses no dashboard
- [ ] Antecipação de recebíveis (Asaas API)

---

## Sprint 9-10 — Segurança, RBAC e LGPD

**Objetivo:** Produto pronto para crescimento e compliance.

### Entregas
- [ ] RBAC: OWNER / PROFESSIONAL / RECEPTIONIST / PLATFORM_ADMIN
- [ ] Criptografia de CPF/CNPJ (AES-256 no app layer)
- [ ] Opt-out WhatsApp (cliente pede para parar)
- [ ] Direito ao esquecimento: anonimização + soft delete
- [ ] Retenção de histórico de conversa (TTL via expiresAt)
- [ ] Rate limiting geral na API
- [ ] Janela de contexto da IA com controle de tokens
- [ ] Proteção contra prompt injection

---

## Sprint 11-12 — Escala e Operações

**Objetivo:** Sistema pronto para múltiplos salões e tráfego real.

### Entregas
- [ ] Multi-salão com sub-contas e faturamento separado
- [ ] Circuit breakers para OpenAI, Asaas, Meta API
- [ ] Retry policies com exponential backoff
- [ ] Testes de carga (k6): benchmark de agendamentos simultâneos
- [ ] Alertas Grafana: taxa de erro de webhook, fila de mensagens
- [ ] Migração para Zoop (enterprise / franquias)
- [ ] Templates Meta aprovados para todos os tipos de notificação
