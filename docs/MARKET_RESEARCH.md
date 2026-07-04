# 🔍 Pesquisa de Mercado — BeautyFlow

## Segmentação das Soluções Existentes

O mercado de beleza está dividido em dois grupos:

1. **Sistemas de gestão** que usam WhatsApp apenas como canal para enviar link de agendamento
2. **Plataformas de IA** que entendem texto livre, sugerem horários e registram agendamentos

Praticamente nenhum player combina IA conversacional + recorrência estruturada + split de pagamentos no contexto brasileiro.

---

## Concorrentes Diretos (Brasil)

| Player | WhatsApp | IA Conversacional | Recorrência | Split Nativo |
|---|---|---|---|---|
| **Trinks** | Link automático via saudação | ❌ (menu/link) | ❌ | ❌ |
| **AppBarber + Barber.IA** | ✅ IA integrada ao sistema | ✅ | ❌ | Comissão interna |
| **BarberBot** | ✅ Bot com confirmações | Parcial | ❌ | ❌ |
| **HiBeauty / HiBarber** | ✅ IA 24h | ✅ | ❌ | ❌ |
| **Atendente.AI** | ✅ IA via QR Code | ✅ | ❌ | ❌ |
| **ChatInteligente.com** | ✅ Omnichannel | IA/automação | ❌ | ❌ |
| **Gendo Zap PRO** | ✅ texto + áudio | ✅ | ❌ | ❌ |

## Concorrentes Indiretos / Internacionais

| Player | Destaque | Limitação |
|---|---|---|
| **Booksy** | Agenda avançada multi-profissional | WhatsApp só como away message |
| **Trim Business** | Subscription billing via Stripe | Sem foco em WhatsApp |
| **Monthly Club** | Planos mensais para cabeleireiros | Sem canal WhatsApp nativo |
| **Subport** | Membership app para barbearias | Sem WhatsApp |

---

## 🎯 Gaps de Mercado (nossa oportunidade)

### 1. Inteligência Conversacional Profunda
Apenas Gendo Zap PRO declara suporte a texto livre e áudio. A maioria ainda usa menus ou links, quebrando a naturalidade da conversa. Espaço para um agente LLM-first que lide com multi-intent na mesma mensagem.

### 2. Recorrência Nativa no WhatsApp
Nenhuma plataforma de agenda para beleza comunica funcionalidades robustas de planos mensais ("Clube da Barba", "Plano de Manicure") com cobrança recorrente integrada ao fluxo de agendamento.

### 3. Split Automático de Comissões
Gateways como Asaas, Zoop, Iugu e Pagar.me já oferecem split nativo, mas os produtos de agenda/IA não expõem esse fluxo. A operação de comissões fica manual ou apenas dentro do ERP.

### 4. Bloqueio por Inadimplência
Nenhum player conecta diretamente o status da assinatura (paga/atrasada) à permissão de agendar no WhatsApp.

### 5. Antecipação de Recebíveis por Profissional
Nenhum produto no nicho divulga fluxos especializados de antecipação com split — potencial diferencial fintech-first.

---

## 💳 Gateways Recomendados

| Gateway | Split | Recorrência | Pix | Fit |
|---|---|---|---|---|
| **Asaas** | ✅ via walletId (% ou fixo) | ✅ | ✅ | MVP — rápido, microempreendedor |
| **Zoop** | ✅ Payments as a Service, anti-bitributação | ✅ | ✅ | Enterprise/franquias |
| **Pagar.me** | ✅ split rules em assinaturas | ✅ | ✅ | E-commerce/SaaS estruturado |
| **Iugu** | ✅ split em recorrência | ✅ | ✅ | Upgrade/downgrade de planos |

**Estratégia:** MVP com Asaas → escala enterprise com Zoop.
