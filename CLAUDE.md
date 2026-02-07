# CLAUDE.md - Diretivo para Agentes AI

> Documento de referência para qualquer agente AI trabalhando nesta base de código.
> Última atualização: 2026-02-07

---

## Visão Geral do Projeto

**Nome**: Cosméticos App (Dani Cosméticos)
**Tipo**: Sistema de gestão de vendas e estoque para loja de cosméticos
**Plataforma**: Web responsivo (foco tablet), hospedado na Vercel
**Usuário**: Single-user (sem autenticação)

### Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | Next.js (App Router) | 14.x |
| Linguagem | TypeScript (strict) | 5.x |
| Estilização | TailwindCSS + shadcn/ui | 3.x |
| ORM | Prisma | 5.x |
| Banco de Dados | PostgreSQL (Neon) | - |
| Validação | Zod | 3.x |
| Estado/Cache | TanStack React Query | 5.x |
| Deploy | Vercel (serverless) | - |

---

## Arquitetura e Fluxo de Dados

```
Frontend (React + TanStack Query)
        ↕ fetch/mutate
API Routes (Next.js App Router)
        ↕ validação Zod + lógica
Services (regras de negócio)
        ↕ Prisma ORM
PostgreSQL (Neon - connection pooling)
```

### Estrutura de Pastas Chave

```
src/
  app/
    (main)/          → Páginas com layout (sidebar)
      dashboard/     → Painel principal
      vendas/        → Criação e listagem de vendas
      clientes/      → Gestão de clientes
      estoque/       → Gestão de produtos
      relatorios/    → Relatórios
      configuracoes/ → Configurações do sistema
    api/             → Rotas backend (REST)
      sales/         → CRUD vendas + cancelamento
      clients/       → CRUD clientes + devedores
      products/      → CRUD produtos + estoque
      receivables/   → Parcelas e cobranças
      brands/        → Marcas
      categories/    → Categorias
      reports/       → Relatórios
      dashboard/     → Dados do dashboard
      settings/      → Configurações
      import/        → Importação CSV
  components/
    ui/              → Componentes shadcn/ui (Radix)
    sales/           → Componentes de venda
    clients/         → Componentes de cliente
    products/        → Componentes de produto
    dashboard/       → Widgets do dashboard
    charts/          → Gráficos (Recharts)
    layout/          → Sidebar, header
  hooks/             → Custom hooks (React Query wrappers)
  lib/               → Utilitários (prisma, cache, errors, utils)
  schemas/           → Schemas Zod de validação
  services/          → Lógica de negócio
  types/             → Tipos TypeScript
prisma/
  schema.prisma      → Schema do banco de dados
  migrations/        → Migrations
  seed.ts            → Seed de dados
docs/                → Documentação técnica existente
```

---

## Sistema de Agentes

### a) Strategic Planner (Planejador Estratégico)

**Papel**: Analisa requisitos de negócio, prioriza features, identifica riscos e impacto.

**Responsabilidades**:
- Avaliar viabilidade de novas features considerando a arquitetura atual
- Priorizar backlog baseado em valor de negócio vs esforço técnico
- Identificar dependências entre tarefas
- Analisar impacto de mudanças no schema do banco (migrations)

**Acesso**: Leitura de `docs/`, `SPEC.md`, `CLAUDE.md`, `schemas/`, `prisma/schema.prisma`
**Restrição**: Não modifica código. Produz documentos de decisão.

**Antes de propor qualquer feature, verificar**:
1. Existe modelo no Prisma que suporta? Se não, migration necessária
2. Existe endpoint API? Se não, criar em `src/app/api/`
3. Existe hook React Query? Se não, criar em `src/hooks/`
4. Impacto em cache? Quais CACHE_KEYS precisam ser invalidadas?

---

### b) Execution Planner (Planejador de Execução)

**Papel**: Transforma decisões estratégicas em tarefas técnicas concretas e ordenadas.

**Responsabilidades**:
- Quebrar features em tarefas atômicas com arquivos específicos
- Definir ordem de execução respeitando dependências
- Identificar pontos de teste para cada tarefa
- Estimar blast radius de cada mudança

**Acesso**: Leitura completa do codebase
**Restrição**: Não modifica código. Produz plano de execução.

**Template de tarefa**:
```
Tarefa: [descrição]
Arquivos: [lista de arquivos afetados]
Dependências: [tarefas que precisam estar prontas antes]
Teste: [como verificar que funcionou]
Rollback: [como reverter se der errado]
```

---

### c) Coder (Implementador)

**Papel**: Implementa as tarefas definidas pelo Execution Planner.

**Regras obrigatórias**:

1. **Error Handling**: Sempre usar `handleApiError` de `@/lib/errors.ts`
   ```typescript
   // CORRETO
   catch (error) {
     const { message, code, status } = handleApiError(error)
     return NextResponse.json({ error: { code, message } }, { status })
   }

   // ERRADO
   catch (error: any) {
     return NextResponse.json({ error: error.message }, { status: 400 })
   }
   ```

2. **Validação**: Toda entrada de API deve ser validada com Zod
   - Schemas ficam em `src/schemas/`
   - Usar `.safeParse()` para retornar erros formatados
   - Nunca confiar em dados do request sem validar

3. **Transações**: Operações multi-step DEVEM usar `prisma.$transaction`
   - Criação de venda: sale + items + payments + stock + receivables
   - Cancelamento: status + stock restore + receivables
   - Pagamento: receivable update + payment record + sale update

4. **Type Safety**: Nunca usar `any`. Usar tipos do Prisma
   ```typescript
   // CORRETO
   import { Prisma } from '@prisma/client'
   const where: Prisma.SaleWhereInput = {}

   // ERRADO
   const where: any = {}
   ```

5. **Cache**: Invalidar após toda mutação
   ```typescript
   import { cache, CACHE_KEYS } from '@/lib/cache'
   // Após criar/cancelar venda:
   cache.invalidate(CACHE_KEYS.DASHBOARD)
   cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)
   ```

6. **Constantes**: Magic numbers ficam em `@/lib/constants.ts`
   ```typescript
   import { PAYMENT_TOLERANCE, DEFAULT_PAYMENT_DAY } from '@/lib/constants'
   ```

7. **Mensagens**: Sempre em português brasileiro

8. **Soft Delete**: Produtos e Clientes usam `deletedAt`
   - Toda query de produto/cliente DEVE filtrar `deletedAt: null`
   - Nunca deletar fisicamente

9. **Decimal**: Usar `new Decimal()` do Prisma para valores monetários
   - Nunca fazer aritmética direta com Decimal sem converter para Number

10. **Hooks React Query**: Seguir padrão existente em `src/hooks/`
    - Query keys: `['entity']` ou `['entity', filters]`
    - Invalidar queries relacionadas após mutações

---

### d) Reviewer (Revisor)

**Papel**: Revisa código antes de aplicar, garante qualidade e consistência.

**Checklist de revisão**:

- [ ] **Type Safety**: Zero `any`, tipos corretos do Prisma
- [ ] **Error Handling**: Usa `handleApiError`, formato `{ error: { code, message } }`
- [ ] **Validação**: Input validado com Zod antes de processar
- [ ] **Transação**: Operações multi-step dentro de `$transaction`
- [ ] **Cache**: Invalidação correta após mutações
- [ ] **Soft Delete**: Queries filtram `deletedAt: null`
- [ ] **Segurança**: Sem SQL injection, sem dados sensíveis expostos
- [ ] **Constantes**: Sem magic numbers, valores extraídos para constants.ts
- [ ] **Consistência**: Segue padrões existentes no codebase
- [ ] **Mensagens**: Em português, sem typos
- [ ] **Performance**: Queries otimizadas, sem N+1, usa `select` quando possível

---

## Regras de Negócio Críticas

### Produto

```
salePrice = costPrice × (1 + profitMargin / 100)
```

- Soft delete com `deletedAt`
- Alerta quando `stock <= minStock`
- Código gerado automaticamente se não fornecido (`lib/code-generator.ts`)
- Unique constraint: `(brandId, linha, fragrancia, categoryId, packagingType)`

### Venda (Criação)

```
1. Validar existência e estoque dos produtos
2. Buscar desconto do cliente (se vinculado)
3. Calcular subtotal = Σ(unitPrice × quantity)
4. discountAmount = subtotal × (discountPercent / 100)
5. Para cada pagamento:
   - feeAmount = amount × (feePercent / 100)
   - Se feeAbsorber = SELLER → soma em totalFees
6. total = subtotal - discountAmount
7. netTotal = total - totalFees
8. Se paidAmount >= total → COMPLETED, senão → PENDING (fiado)
9. TRANSAÇÃO ATÔMICA:
   a. Criar Sale
   b. Criar SaleItems
   c. Criar Payments
   d. Decrementar stock de cada produto
   e. Criar StockMovements (audit trail)
   f. Se fiado: criar Receivables (parcelas)
10. Invalidar cache do dashboard
```

### Venda (Cancelamento)

```
1. Verificar status ≠ CANCELLED
2. TRANSAÇÃO ATÔMICA:
   a. Marcar sale.status = CANCELLED
   b. Restaurar stock de cada produto
   c. Criar StockMovements tipo CANCELLATION
   d. Cancelar receivables pendentes (status = CANCELLED)
3. Invalidar cache
```

### Sistema Fiado (Parcelas)

```
- Vendas não pagas integralmente geram Receivables
- Cada receivable = 1 parcela com valor, vencimento e status
- Status: PENDING → PARTIAL (pagamento parcial) → PAID
- Status: PENDING → OVERDUE (passou do vencimento)
- Status: PENDING/PARTIAL → CANCELLED (venda cancelada)
- Dia de pagamento configurável por venda (paymentDay)
- Distribuição de pagamento: FIFO por número da parcela
- Tolerância de pagamento: R$ 0.01 para arredondamentos
```

### Taxas de Pagamento

| Método | Taxa Padrão | Parcelas |
|--------|-------------|----------|
| CASH | 0% | N/A |
| PIX | 0% | N/A |
| DEBIT | 1.5% (config) | N/A |
| CREDIT | 3-4% (config) | 1-12x |

**Absorção**: SELLER (desconta do netTotal) ou CLIENT (soma no total cobrado)

---

## Modelos do Banco (Resumo)

| Modelo | Descrição | Soft Delete |
|--------|-----------|-------------|
| Product | Produtos com preço, estoque, margem | Sim |
| Client | Clientes com desconto fixo | Sim |
| Sale | Vendas (COMPLETED/PENDING/CANCELLED) | Não |
| SaleItem | Itens de cada venda | Não (cascade) |
| Payment | Registros de pagamento | Não (cascade) |
| Receivable | Parcelas fiado (PENDING/PARTIAL/PAID/OVERDUE/CANCELLED) | Não (cascade) |
| StockMovement | Audit trail de estoque | Não |
| Category | Categorias de produto | Não |
| Brand | Marcas com margem padrão | Não |
| Settings | Configurações globais (singleton id="default") | Não |

---

## Cache (In-Memory)

| Chave | TTL | Invalidar quando |
|-------|-----|-------------------|
| DASHBOARD | 2 min | Criar/cancelar venda, registrar pagamento |
| COUNTS | 5 min | CRUD de produtos/clientes |
| REPORTS | 5 min | Criar/cancelar venda |
| SETTINGS | 10 min | Atualizar configurações |
| RECEIVABLES_SUMMARY | 5 min | Criar/cancelar venda, registrar pagamento |

---

## Comandos de Desenvolvimento

```bash
npm run dev          # Dev server
npm run build        # Build produção
npm run typecheck    # Verificação de tipos
npm run lint         # ESLint
npm run lint:fix     # ESLint com auto-fix
npm run format       # Prettier
npx prisma migrate dev    # Rodar migrations
npx prisma db push        # Push schema (sem migration)
npx prisma db seed        # Seed do banco
npx prisma studio         # Interface visual do banco
```

---

## Integração WhatsApp (Planejamento Futuro)

> Status: PLANEJADO - Não implementado ainda

### Objetivo

Permitir comunicação direta com clientes via WhatsApp para cobranças, lembretes e notificações.

### Opções de API

| Provedor | Tipo | Custo | Complexidade |
|----------|------|-------|--------------|
| Evolution API | Open-source, auto-hospedado | Gratuito | Média (precisa servidor) |
| Z-API | SaaS brasileiro | Pago | Baixa |
| Baileys | Lib Node.js | Gratuito | Alta (manutenção manual) |

### Casos de Uso Planejados

1. **Lembrete de parcela**: Envio automático X dias antes do vencimento
2. **Cobrança de atraso**: Notificação quando receivable fica OVERDUE
3. **Confirmação de venda**: Mensagem com resumo após criar venda
4. **Chat direto**: Botão "Enviar WhatsApp" no perfil do cliente

### Arquitetura Futura

```
Cosméticos App → src/services/whatsapp.service.ts → [WhatsApp Provider API]
                                                          ↑
                        POST /api/whatsapp/webhook ← Webhooks de status
```

### Modelos Futuros (não criar ainda)

- `MessageLog` - Registro de mensagens enviadas (clientId, type, content, status)
- `MessageTemplate` - Templates reutilizáveis de mensagem
- Enums: `MessageType` (REMINDER, OVERDUE, SALE_CONFIRMATION, MANUAL)
- Enums: `MessageStatus` (SENT, DELIVERED, READ, FAILED)

### Pré-requisitos

- Número de WhatsApp Business dedicado
- Escolha do provedor de API
- Servidor para hospedar (se Evolution API)
- Variáveis de ambiente: `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`

---

## Bugs Conhecidos e Correções Aplicadas

### Corrigido: Cálculo de Data de Parcela

**Arquivo**: `src/app/api/sales/route.ts`
**Problema**: Quando paymentDay=30 em fevereiro, `new Date(year, 1, 30)` criava 2 de março. O `setDate(0)` voltava para janeiro em vez de fevereiro.
**Correção**: Usar `Math.min(day, lastDayOfMonth)` para limitar ao último dia do mês correto.

### Corrigido: Cancelamento Não Cancelava Receivables

**Arquivo**: `src/app/api/sales/[id]/cancel/route.ts`
**Problema**: Ao cancelar venda, receivables ficavam PENDING.
**Correção**: Adicionado `CANCELLED` ao enum `ReceivableStatus` + `updateMany` na transação de cancelamento.

### Corrigido: Error Handling Inconsistente

**Arquivos**: `receivables/[id]/pay/route.ts`, `receivables/pay-sale/route.ts`, `sales/[id]/cancel/route.ts`
**Problema**: Usavam `error.message` direto ou `console.error` sem handler centralizado.
**Correção**: Padronizado para usar `handleApiError` de `@/lib/errors.ts`.

### Corrigido: Código Morto no Service

**Arquivo**: `src/services/receivable.service.ts`
**Problema**: `_existingPayments` e `_isFullyPaid` calculados mas nunca usados.
**Correção**: Removidos.

### Corrigido: Queries Não Filtravam CANCELLED

**Arquivos**: `src/services/receivable.service.ts`, `src/app/api/receivables/`
**Problema**: Após adicionar status CANCELLED, diversas queries continuavam retornando receivables cancelados em listas de devedores, cálculos de saldo, e até permitiam pagamentos.
**Correções aplicadas**:
- `registerPayment()` agora rejeita parcelas CANCELLED e PAID
- `updateSalePaidAmount()` exclui CANCELLED ao somar
- `listByClient()` exclui CANCELLED
- `list()` exclui CANCELLED por padrão quando sem filtro
- `allReceivablesPaid` exclui CANCELLED nos 2 métodos de pagamento
- PATCH `/api/receivables/[id]` rejeita parcelas CANCELLED
- Todos endpoints de receivables usam `handleApiError` (zero `any` types)
- Cache invalidation adicionado no PATCH de receivable

---

## Referências

- `SPEC.md` - Especificação técnica original
- `docs/` - Documentação detalhada por módulo
- `docs/06-REGRAS-NEGOCIO.md` - Regras de negócio e validações
- `prisma/schema.prisma` - Schema completo do banco
