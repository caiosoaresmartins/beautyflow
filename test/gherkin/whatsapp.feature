Feature: Canal WhatsApp Business

  Scenario: Webhook Meta com assinatura inválida
    Given um agente envia POST para /webhooks/whatsapp
    When o header X-Hub-Signature-256 está ausente ou incorreto
    Then o sistema retorna 403 Forbidden
    And nenhuma mensagem é processada

  Scenario: Lembrete dentro da janela de 24h
    Given o cliente interagiu com o bot há 2 horas
    When o sistema envia lembrete de agendamento
    Then usa mensagem de texto livre

  Scenario: Lembrete fora da janela de 24h
    Given o cliente não interage há 30 horas
    When o sistema envia lembrete de agendamento
    Then usa template aprovado pela Meta "appointment_reminder"
    And NÃO tenta enviar mensagem de texto livre

  Scenario: Opt-out LGPD
    When o cliente envia "Para de me mandar mensagem"
    Then Client.optedOut = true
    And Client.optedOutAt é preenchido
    And sistema confirma o opt-out via WhatsApp
    And nenhum lembrete futuro é enviado para este número

  Scenario: Reativação após opt-out
    Given Client.optedOut = true
    When o cliente envia mensagem espontaneamente
    Then optedOut = false
    And consentimento implícito registrado com timestamp
