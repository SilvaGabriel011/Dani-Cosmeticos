# 02 - Arquitetura

## Estrutura de Pastas

```
cosmeticos-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Redirect para /dashboard
│   │   ├── globals.css
│   │   ├── providers.tsx               # QueryClientProvider
│   │   │
│   │   ├── (main)/                     # Layout com sidebar
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── estoque/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── vendas/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nova/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── clientes/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── relatorios/page.tsx
│   │   │   └── configuracoes/page.tsx
│   │   │
│   │   └── api/
│   │       ├── products/
│   │       │   ├── route.ts
│   │       │   ├── [id]/route.ts
│   │       │   └── low-stock/route.ts
│   │       ├── categories/route.ts
│   │       ├── clients/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── sales/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── cancel/route.ts
│   │       ├── reports/
│   │       │   ├── summary/route.ts
│   │       │   ├── by-product/route.ts
│   │       │   └── by-payment/route.ts
│   │       └── settings/route.ts
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── page-header.tsx
│   │   ├── products/
│   │   │   ├── product-form.tsx
│   │   │   ├── product-table.tsx
│   │   │   └── low-stock-alert.tsx
│   │   ├── clients/
│   │   │   ├── client-form.tsx
│   │   │   ├── client-table.tsx
│   │   │   └── client-select.tsx
│   │   ├── sales/
│   │   │   ├── sale-form/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── item-selector.tsx
│   │   │   │   ├── payment-form.tsx
│   │   │   │   └── summary.tsx
│   │   │   ├── sale-table.tsx
│   │   │   └── sale-details.tsx
│   │   └── dashboard/
│   │       ├── summary-cards.tsx
│   │       ├── recent-sales.tsx
│   │       └── low-stock-list.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   ├── schemas/
│   │   ├── product.schema.ts
│   │   ├── client.schema.ts
│   │   ├── sale.schema.ts
│   │   └── settings.schema.ts
│   │
│   ├── services/
│   │   ├── product.service.ts
│   │   ├── client.service.ts
│   │   ├── sale.service.ts
│   │   ├── report.service.ts
│   │   └── settings.service.ts
│   │
│   ├── hooks/
│   │   ├── use-products.ts
│   │   ├── use-clients.ts
│   │   ├── use-sales.ts
│   │   ├── use-categories.ts
│   │   ├── use-settings.ts
│   │   └── use-reports.ts
│   │
│   └── types/
│       └── index.ts
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── .env.example
├── package.json
├── tailwind.config.ts
├── components.json                     # shadcn config
└── README.md
```

---

## Camadas da Aplicação

```
┌─────────────────────────────────────────┐
│              PRESENTATION               │
│         (Components + Pages)            │
│   React Components, Forms, Tables       │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│               HOOKS LAYER               │
│         (React Query + Hooks)           │
│   useProducts, useSales, useClients     │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│              API ROUTES                 │
│         (Next.js API Routes)            │
│   Validação, Roteamento                 │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│            SERVICE LAYER                │
│         (Business Logic)                │
│   Regras de negócio, cálculos           │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│             DATA LAYER                  │
│         (Prisma ORM)                    │
│   Acesso ao banco de dados              │
└─────────────────────────────────────────┘
```

---

## Padrões Adotados

| Padrão | Descrição |
|--------|-----------|
| **Separação de responsabilidades** | UI ↔ Lógica ↔ Dados |
| **Validação com Zod** | Schemas reutilizáveis |
| **React Query** | Cache e sincronização de dados |
| **TypeScript** | Tipagem estrita |
| **Componentes atômicos** | Pequenos e reutilizáveis |
| **Soft delete** | Nunca deletar fisicamente |
