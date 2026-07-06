# Campos adicionais necessários no schema.prisma

## Booking — adicionar campo reminderSentAt
```prisma
model Booking {
  // ... campos existentes ...
  reminderSentAt DateTime? // Controla envio de lembrete 24h
}
```

## Salon — adicionar campo whatsappPhoneNumberId
```prisma
model Salon {
  // ... campos existentes ...
  whatsappPhoneNumberId String? // phoneNumberId da Meta para roteamento
}
```

## Client — adicionar campo gatewayCustomerId
```prisma
model Client {
  // ... campos existentes ...
  gatewayCustomerId String? // ID do customer no Asaas
}
```

## ConversationMessage — garantir campos role e expiresAt
```prisma
model ConversationMessage {
  id        String   @id @default(cuid())
  clientId  String
  salonId   String
  role      String   // "user" | "assistant" | "system"
  content   String   @db.Text
  expiresAt DateTime // LGPD TTL 30 dias
  createdAt DateTime @default(now())
  client    Client   @relation(fields: [clientId], references: [id])
  salon     Salon    @relation(fields: [salonId], references: [id])
  @@map("conversation_messages")
}
```

> Após editar o schema, rodar:
> ```bash
> npx prisma migrate dev --name fase2-whatsapp-billing
> npx prisma generate
> ```
