Feature: Cobrança recorrente e split financeiro

  Scenario: Idempotência de webhook de pagamento
    Given o gateway Asaas enviou PAYMENT_RECEIVED com id "evt_abc123"
    And o evento foi processado com sucesso
    When o gateway reenvia o mesmo payload
    Then o sistema retorna 200 OK sem processar novamente
    And nenhuma ação duplicada é executada

  Scenario: Webhook com assinatura inválida
    When payload chega sem o header "asaas-access-token" correto
    Then o sistema retorna 401 Unauthorized
    And o evento é registrado como suspeito no log

  Scenario: Transação atômica booking + crédito
    Given o cliente tem 1 crédito disponível no Clube da Barba
    And a conexão falha após INSERT booking mas antes de UPDATE credits
    When o cliente tenta agendar
    Then o agendamento NÃO é persistido
    And o crédito NÃO é consumido

  Scenario: Split automático em cobrança de R$ 100,00
    Given CommissionRule para o profissional: 60% / 25% / 15%
    When cliente paga R$ 100,00 por cartão
    Then ChargeSplit criado para profissional com ~60% do valor líquido
    And ChargeSplit criado para salão com ~25% do valor líquido
    And ChargeSplit criado para plataforma com ~15% do valor líquido
    And repasse ocorre automaticamente no gateway

  Scenario: Reembolso parcial com reversão de split
    Given charge de R$ 100,00 com splits em status DONE
    When reembolso de R$ 30,00 é solicitado
    Then sistema calcula 30% de reversão em cada split
    And ChargeSplit status atualizado para PARTIALLY_REFUNDED
    And Charge.refundedAmount = 30.00
