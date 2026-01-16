# 06 - Regras de Negócio

## Produto

### Cálculo do Preço de Venda

```
salePrice = costPrice × (1 + profitMargin / 100)
```

**Exemplo:**
- Custo: R$ 50,00
- Margem: 40%
- Preço de venda: 50 × 1.40 = R$ 70,00

### Soft Delete

- Nunca deletar fisicamente
- Marcar `deletedAt` com data/hora atual
- Filtros padrão: `WHERE deletedAt IS NULL`

### Alerta de Estoque

- Mostrar alerta quando `stock <= minStock`
- Configurável em Settings (`lowStockAlertEnabled`)

---

## Venda

### Criação de Venda

```
1. Validar estoque
   - Se stock = 0: alertar mas permitir
   - Não bloquear venda

2. Para cada item:
   - Guardar unitPrice = produto.salePrice (no momento)
   - Guardar costPrice = produto.costPrice (no momento)
   - total = unitPrice × quantity
   - Decrementar produto.stock

3. Calcular subtotal
   subtotal = Σ(item.total)

4. Aplicar desconto (se cliente)
   - discountPercent = cliente.discount
   - discountAmount = subtotal × (discountPercent / 100)

5. Para cada pagamento:
   - Se DEBIT ou CREDIT:
     - feePercent = taxa da config ou input
     - feeAmount = amount × (feePercent / 100)
   - Se PIX ou CASH:
     - feePercent = 0
     - feeAmount = 0

6. Calcular totalFees (taxa que vendedor paga)
   totalFees = Σ(payment.feeAmount) onde feeAbsorber = SELLER

7. Calcular total cobrado
   - feesClientPays = Σ(payment.feeAmount) onde feeAbsorber = CLIENT
   - total = subtotal - discountAmount + feesClientPays

8. Calcular valor líquido
   netTotal = subtotal - discountAmount - totalFees
```

### Cancelamento de Venda

```
1. Verificar se status != CANCELLED

2. Marcar status = CANCELLED

3. Para cada item:
   produto.stock += item.quantity

4. Manter registro para histórico
```

---

## Pagamento

### Regras por Método

| Método | Taxa | Parcelas |
|--------|------|----------|
| CASH | 0% | N/A |
| PIX | 0% | N/A |
| DEBIT | Config (default 1.5%) | N/A |
| CREDIT | Config (default 3-4%) | 1-12x |

### Quem Absorve a Taxa

| Absorvedor | Comportamento |
|------------|---------------|
| SELLER | Taxa desconta do netTotal |
| CLIENT | Taxa soma no total cobrado |

**Exemplo: Venda R$ 100 no crédito (taxa 3%)**

Se SELLER absorve:
- Total cobrado: R$ 100,00
- Taxa: R$ 3,00
- Net total: R$ 97,00

Se CLIENT paga:
- Subtotal: R$ 100,00
- Taxa: R$ 3,00
- Total cobrado: R$ 103,00
- Net total: R$ 100,00

---

## Validações (Zod Schemas)

### Product

```typescript
const productCreateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Nome obrigatório"),
  categoryId: z.string().uuid().optional().nullable(),
  costPrice: z.number().positive("Custo deve ser positivo"),
  profitMargin: z.number().min(0).max(1000),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
});

const productUpdateSchema = productCreateSchema.partial();
```

### Client

```typescript
const clientCreateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  phone: z.string().min(1, "Telefone obrigatório"),
  address: z.string().min(1, "Endereço obrigatório"),
  discount: z.number().min(0).max(100).default(0),
});

const clientUpdateSchema = clientCreateSchema.partial();
```

### Sale

```typescript
const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const paymentSchema = z.object({
  method: z.enum(["CASH", "PIX", "DEBIT", "CREDIT"]),
  amount: z.number().positive(),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(["SELLER", "CLIENT"]).default("SELLER"),
  installments: z.number().int().min(1).max(12).default(1),
});

const saleCreateSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "Adicione ao menos um item"),
  payments: z.array(paymentSchema).min(1, "Adicione forma de pagamento"),
});
```

### Settings

```typescript
const settingsUpdateSchema = z.object({
  debitFeePercent: z.number().min(0).max(100),
  creditFeePercent: z.number().min(0).max(100),
  creditInstallmentFee: z.number().min(0).max(100),
  defaultFeeAbsorber: z.enum(["SELLER", "CLIENT"]),
  lowStockAlertEnabled: z.boolean(),
});
```

---

## Validações de Negócio

### Ao criar venda

- [ ] Ao menos 1 item
- [ ] Ao menos 1 forma de pagamento
- [ ] Soma dos pagamentos = total da venda
- [ ] Parcelas só para CREDIT
- [ ] Quantidade positiva

### Ao cancelar venda

- [ ] Venda não pode já estar cancelada
- [ ] Devolver estoque

### Ao deletar produto

- [ ] Soft delete apenas
- [ ] Produtos com vendas: mantém histórico

### Ao deletar cliente

- [ ] Soft delete apenas
- [ ] Clientes com vendas: mantém histórico
