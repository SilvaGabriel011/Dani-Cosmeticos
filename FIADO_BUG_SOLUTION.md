# Analise e Solucao: Bug na Area de Pagamento Fiado

## Resumo do Problema

Ao cadastrar um pagamento na area de vendas fiado na dashboard, a venda desaparece da tabela. O usuario relata que um cliente pode pagar mais do que as parcelas combinadas mas continuar devendo valor, e a venda some apos o pagamento da segunda parcela.

## Analise da Causa Raiz

### 1. Problema Principal: Filtro Incorreto de Receivables

**Arquivo:** `src/components/dashboard/fiado-table.tsx` (linhas 39-42)

```typescript
const { data: receivablesData, isLoading } = useReceivables({ 
  status: "PENDING",
  limit: 100 
})
```

**Problema:** A tabela de fiado busca apenas receivables com status `PENDING`. Quando um pagamento e registrado:

- Se o pagamento cobre o valor total da parcela: status muda para `PAID`
- Se o pagamento e parcial: status muda para `PARTIAL`

Em ambos os casos, a receivable deixa de aparecer na consulta porque nao tem mais status `PENDING`.

### 2. Logica de Agrupamento por Venda

**Arquivo:** `src/components/dashboard/fiado-table.tsx` (linhas 48-98)

A tabela agrupa receivables por venda (`saleId`) e calcula:
- `paidInstallments`: conta receivables com `status === "PAID"` **dos dados retornados**
- `totalInstallments`: pega o maior numero de parcela dos dados retornados

**Problema:** Como apenas receivables `PENDING` sao buscadas:
- `paidInstallments` sempre sera 0 (nao ha PAID nos dados)
- Quando todas as parcelas pendentes de uma venda sao pagas ou ficam PARTIAL, a venda "desaparece"

### 3. Restricao de Pagamento por Parcela

**Arquivo:** `src/components/dashboard/receivable-payment-modal.tsx` (linhas 70-77)

```typescript
if (amount > remaining + 0.01) {
  toast({ 
    title: "Valor excede o saldo da parcela", 
    description: `Maximo: ${formatCurrency(remaining)}`,
    variant: "destructive" 
  })
  return
}
```

**Problema:** O sistema nao permite pagar mais do que o saldo restante de uma unica parcela. Se o cliente quer pagar R$200 mas a parcela atual e de R$100, ele nao consegue. O excedente deveria ser aplicado nas proximas parcelas.

### 4. Fluxo de Pagamento no Service

**Arquivo:** `src/services/receivable.service.ts` (linhas 111-203)

O `registerPayment` atualiza:
1. O `paidAmount` da receivable
2. O status da receivable (PENDING -> PARTIAL -> PAID)
3. Cria um registro de Payment
4. Atualiza o `paidAmount` da Sale
5. Se todas receivables estao PAID, muda o status da Sale para COMPLETED

**Problema:** O pagamento e aplicado apenas a uma receivable por vez. Nao ha logica para distribuir pagamentos excedentes entre multiplas parcelas.

## Solucao Proposta

### Correcao 1: Alterar Filtro da FiadoTable

Mudar a query para buscar receivables com status `PENDING` **ou** `PARTIAL`:

```typescript
// src/components/dashboard/fiado-table.tsx
const { data: receivablesData, isLoading } = useReceivables({ 
  status: "PENDING,PARTIAL", // Buscar ambos os status
  limit: 100 
})
```

**Alteracao necessaria no backend:**

```typescript
// src/app/api/receivables/route.ts
// Permitir multiplos status separados por virgula
const statusList = filters.status?.split(',') as ReceivableStatus[]
```

```typescript
// src/services/receivable.service.ts
async list(filters: ListFilters = {}) {
  const { status, ... } = filters
  return prisma.receivable.findMany({
    where: {
      ...(status && Array.isArray(status) 
        ? { status: { in: status } }
        : { status }),
      // ...
    },
    // ...
  })
}
```

### Correcao 2: Buscar Todas Receivables da Venda para Calculo

Ao agrupar por venda, buscar TODAS as receivables da venda (incluindo PAID) para calcular corretamente:

```typescript
// src/components/dashboard/fiado-table.tsx
// Opcao A: Fazer query separada para cada venda (menos eficiente)
// Opcao B: Mudar a API para retornar todas receivables de vendas que tem pendencias

// Melhor abordagem: criar endpoint especifico para dashboard fiado
// GET /api/receivables/fiado-summary
```

### Correcao 3: Permitir Pagamentos Excedentes

Modificar o modal de pagamento para permitir valores maiores que a parcela atual:

```typescript
// src/components/dashboard/receivable-payment-modal.tsx
// Remover ou ajustar a validacao de valor maximo
// Calcular o total pendente de TODAS as parcelas da venda

const totalRemaining = allReceivablesForSale
  .filter(r => r.status !== 'PAID')
  .reduce((sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)), 0)

if (amount > totalRemaining + 0.01) {
  toast({ 
    title: "Valor excede o saldo total devedor", 
    description: `Maximo: ${formatCurrency(totalRemaining)}`,
    variant: "destructive" 
  })
  return
}
```

### Correcao 4: Distribuir Pagamento Entre Parcelas

Criar logica no service para distribuir pagamentos excedentes:

```typescript
// src/services/receivable.service.ts
async registerPaymentWithDistribution(
  saleId: string, 
  amount: number, 
  paymentMethod: PaymentMethod,
  paidAt?: Date
) {
  const receivables = await prisma.receivable.findMany({
    where: { 
      saleId, 
      status: { in: ['PENDING', 'PARTIAL'] } 
    },
    orderBy: { installment: 'asc' }
  })

  let remainingPayment = amount

  await prisma.$transaction(async (tx) => {
    for (const receivable of receivables) {
      if (remainingPayment <= 0) break

      const receivableRemaining = Number(receivable.amount) - Number(receivable.paidAmount)
      const paymentForThis = Math.min(remainingPayment, receivableRemaining)

      const newPaidAmount = Number(receivable.paidAmount) + paymentForThis
      const newStatus = newPaidAmount >= Number(receivable.amount) ? 'PAID' : 'PARTIAL'

      await tx.receivable.update({
        where: { id: receivable.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          paidAt: newStatus === 'PAID' ? (paidAt || new Date()) : null,
        }
      })

      remainingPayment -= paymentForThis
    }

    // Criar registro de Payment
    await tx.payment.create({
      data: {
        saleId,
        method: paymentMethod,
        amount,
        feePercent: 0,
        feeAmount: 0,
        feeAbsorber: 'SELLER',
        installments: 1,
      }
    })

    // Atualizar paidAmount da Sale
    // ... (logica existente)
  })
}
```

## Plano de Implementacao

### Fase 1: Correcao Imediata (Bug Critico)
1. Alterar `fiado-table.tsx` para buscar status `PENDING` e `PARTIAL`
2. Ajustar `receivable.service.ts` para aceitar array de status
3. Ajustar `receivables/route.ts` para parsear multiplos status

### Fase 2: Melhoria de UX
1. Criar endpoint `/api/receivables/fiado-summary` que retorna vendas com pendencias e todas suas parcelas
2. Refatorar `fiado-table.tsx` para usar o novo endpoint
3. Mostrar corretamente parcelas pagas vs pendentes

### Fase 3: Pagamentos Flexiveis
1. Implementar `registerPaymentWithDistribution` no service
2. Criar novo endpoint ou modificar `/api/receivables/[id]/pay` para aceitar pagamentos distribuidos
3. Atualizar modal de pagamento para mostrar total devedor e permitir pagamentos maiores

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/dashboard/fiado-table.tsx` | Filtro de status, calculo de parcelas |
| `src/services/receivable.service.ts` | Suporte a array de status, distribuicao de pagamentos |
| `src/app/api/receivables/route.ts` | Parse de multiplos status |
| `src/components/dashboard/receivable-payment-modal.tsx` | Validacao de valor maximo |
| `src/hooks/use-receivables.ts` | Novo hook para fiado summary (opcional) |

## Testes Recomendados

1. Criar venda fiado com 3 parcelas
2. Pagar parcialmente a 1a parcela - verificar que venda continua aparecendo
3. Pagar totalmente a 1a parcela - verificar que venda continua aparecendo
4. Pagar valor maior que uma parcela - verificar distribuicao
5. Pagar todas as parcelas - verificar que venda sai da lista

## Conclusao

O bug principal e causado pelo filtro que busca apenas receivables com status `PENDING`, fazendo com que vendas com parcelas `PARTIAL` ou `PAID` desaparecam da tabela. A solucao imediata e incluir o status `PARTIAL` na busca. Para uma experiencia completa, recomenda-se implementar a distribuicao de pagamentos entre parcelas.
