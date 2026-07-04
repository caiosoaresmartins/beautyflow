Feature: Agendamento via WhatsApp

  Scenario: Agendamento com texto livre bem-sucedido
    Given o salão "Barbearia Alpha" está ativo com timezone "America/Sao_Paulo"
    And o profissional "Ana" trabalha das 09h às 18h às terças
    And o serviço "Corte de Cabelo" tem duração de 30 minutos
    When o cliente envia "Oi, tem horário pra cabelo amanhã à tarde?"
    Then a IA retorna slots disponíveis no período da tarde
    And o cliente confirma "14h com Ana"
    And o booking é criado com status CONFIRMED
    And uma mensagem de confirmação é enviada via WhatsApp

  Scenario: Prevenção de double-booking
    Given Ana tem disponibilidade às 14h amanhã
    When dois clientes disparam createBooking para Ana/14h simultaneamente via Promise.all
    Then apenas um agendamento é confirmado
    And o segundo recebe erro 409 Conflict
    And nenhum slot duplicado existe no banco de dados

  Scenario: Bloqueio de agenda por inadimplência
    Given o cliente "João" tem Clube da Barba com status "PAST_DUE"
    When João envia "Quero agendar corte amanhã às 14h"
    Then a IA NÃO cria o agendamento
    And responde com link de pagamento para regularização

  Scenario: Slots respeitam durationMinutes do serviço
    Given o serviço "Coloração" tem duração de 90 minutos
    And Ana trabalha das 09h às 18h sem agendamentos
    When o cliente consulta disponibilidade para Coloração
    Then os slots são [09:00, 10:30, 12:00, 13:30, 15:00, 16:30]
    And nenhum slot tem início a menos de 90 min do anterior

  Scenario: Timezone correto para salão em Manaus
    Given o salão tem timezone "America/Manaus" (UTC-4)
    And o profissional trabalha das 08h às 18h no horário local
    When o sistema gera slots para hoje
    Then nenhum slot aparece antes das 08:00 horário de Manaus
    And os slots em UTC correspondem a 12:00–22:00 UTC
