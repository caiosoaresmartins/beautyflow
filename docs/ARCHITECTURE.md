# 🏗️ Arquitetura Técnica — BeautyFlow

## Componentes Principais

```
┌─────────────────────────────────────────────────────────────────┐
│  Cliente (WhatsApp)                                             │
│       │  mensagem de texto / áudio                             │
│       ▼                                                         │
│  ┌──────────────────┐    webhook    ┌─────────────────────┐    │
│  │  WhatsApp        │──────────────▶│  Channel Gateway    │    │
│  │  Business API    │              │  (Meta Webhook)     │    │
│  └──────────────────┘              └──────────┬──────────┘    │
│                                               │                │
│                                               ▼                │
│                                  ┌────────────────────────┐   │
│                                  │  AI Orchestrator       │   │
│                                  │  (Agentic Loop)        │   │
│                                  │  ┌──────────────────┐  │   │
│                                  │  │ Intent Detection │  │   │
│                                  │  │ Entity Extract   │  │   │
│                                  │  │ Tool Calling     │  │   │
│                                  │  └──────────────────┘  │   │
│                                  └──────┬─────────┬───────┘   │
│                                         │         │            │
│                          ┌──────────────┘         └──────────┐│
│                          ▼                                    ▼│
│               ┌─────────────────┐              ┌────────────────┐│
│               │ Scheduling      │              │ Billing &      ││
│               │ Engine          │              │ Payments       ││
│               │ (Booking Svc)   │              │ Service        ││
│               └────────┬────────┘              └───────┬────────┘│
│                        │                               │         │
│                        ▼                               ▼         │
│               ┌─────────────────┐              ┌────────────────┐│
│               │  PostgreSQL     │              │ Gateway        ││
│               │  (Prisma)       │              │ (Asaas/Zoop)   ││
│               └─────────────────┘              └────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Conversa da IA

### Exemplo: "Oi, tem horário pra cabelo amanhã à tarde?"

```
1. Recepção
   └→ Webhook Meta → Channel Gateway → AI Orchestrator
   └→ Contexto carregado: histórico (últimas N msgs / ≤8k tokens), plano do cliente

2. Interpretação (LLM)
   └→ Intent: agendar_servico
   └→ Entidades: serviço=cabelo, data=amanhã, período=tarde
   └→ Profissional: não especificado → perguntar ou qualquer disponível

3. Tool Call: check_availability
   └→ GET /availability?service=cabelo&date=YYYY-MM-DD&period=tarde
   └→ Aplica: durationMinutes, timezone do salão, LeaveBlocks, SalonHolidays

4. Tool Call: check_subscription_status
   └→ Se PAST_DUE → bloqueia e envia link de pagamento
   └→ Se ACTIVE → prossegue com sugestão de horários

5. Sugestão humanizada
   └→ "Tenho às 14h com Ana ou 16h com João. Qual prefere? ✂️"

6. Confirmação explícita do cliente
   └→ LLM aguarda resposta afirmativa antes de criar booking

7. Tool Call: create_booking (transação atômica)
   └→ SELECT FOR UPDATE NOWAIT (anti-double-booking)
   └→ UPDATE subscription_credits (decremento atômico)
   └→ INSERT booking

8. Pós-agendamento
   └→ Confirmação via WhatsApp
   └→ Lembrete agendado (com lógica de janela 24h Meta)
```

---

## Agentic Loop — Código de Referência

```typescript
async processMessage(clientId: string, message: string): Promise<string> {
  const messages = [
    { role: 'system', content: this.buildSystemPrompt() },
    ...await this.getConversationHistory(clientId), // janela de tokens
    { role: 'user', content: message },
  ];

  const MAX_ITERATIONS = 10;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: this.tools,
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      return assistantMessage.content ?? '';
    }

    // Processa TODOS os tool calls em paralelo
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (tc) => ({
        role: 'tool' as const,
        tool_call_id: tc.id,
        content: JSON.stringify(await this.executeToolCall(tc)),
      }))
    );
    messages.push(...toolResults);
  }

  throw new Error('AI orchestrator excedeu limite de iterações');
}
```

---

## Split Financeiro — Lógica

### Exemplo de cobrança R$ 100,00

```
Valor bruto:       R$ 100,00
Taxa gateway:      R$   3,49 (Asaas ~3,49% cartão)
Valor líquido:     R$  96,51

Split configurado:
  └→ Profissional (60%): R$ 57,91 → walletId: wallet_prof_123
  └→ Salão       (25%): R$ 24,13 → walletId: wallet_salon_456
  └→ Plataforma  (15%): R$ 14,47 → walletId: wallet_platform_789

Repasse: automático no gateway ao receber confirmação de pagamento
Estorno: reversão proporcional em cada walletId se refund solicitado
```

### Lei do Salão Parceiro
- Split na adquirente evita bitributação
- Cada parte recebe diretamente em sua subconta
- Conciliação automática via relatórios de ChargeSplit

---

## Recorrência e Bloqueio por Inadimplência

```
Cliente assina plano → gateway cria subscription → webhook PAYMENT_RECEIVED
  └→ subscription.status = ACTIVE
  └→ subscription.creditsUsed = 0 (novo ciclo)

Renovação mensal:
  └→ Gateway cobra automaticamente
  └→ PAYMENT_RECEIVED → webhook → creditsUsed reset, status ACTIVE
  └→ PAYMENT_FAILED → após N tentativas → status PAST_DUE

Bloqueio:
  └→ createBooking verifica subscription.status
  └→ Se PAST_DUE: erro 402 + link de pagamento enviado via WhatsApp
  └→ Após regularização: PAYMENT_RECEIVED → status ACTIVE → desbloqueado
```

---

## Janela de 24h (Meta WhatsApp Business)

```typescript
async sendReminder(booking: Booking): Promise<void> {
  const lastInteraction = await this.getLastInteractionTime(client.whatsappId);
  const windowOpen = lastInteraction &&
    (Date.now() - lastInteraction.getTime()) < 24 * 3600 * 1000;

  if (windowOpen) {
    // Mensagem de texto livre
    await this.sendTextMessage(client.whatsappId, `Lembrete: ...`);
  } else {
    // Template aprovado pela Meta (obrigatório fora da janela)
    await this.sendTemplateMessage(client.whatsappId, 'appointment_reminder', 'pt_BR', [...]);
  }
}
```
