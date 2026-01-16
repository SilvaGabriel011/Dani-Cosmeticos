# 07 - Checklist de Implementação

## Fase 1: Setup

- [ ] Criar projeto Next.js 14
- [ ] Configurar TailwindCSS
- [ ] Instalar dependências (prisma, zod, react-query, date-fns, lucide)
- [ ] Configurar Prisma
- [ ] Criar schema.prisma
- [ ] Instalar shadcn/ui
- [ ] Criar layout base (sidebar)
- [ ] Configurar providers (QueryClient)

## Fase 2: Backend - Core

- [ ] Criar lib/prisma.ts (singleton)
- [ ] Criar lib/utils.ts (formatCurrency, cn, etc)
- [ ] Criar types/index.ts
- [ ] Criar schemas de validação

## Fase 3: Backend - Products

- [ ] product.service.ts
- [ ] GET /api/products (list)
- [ ] POST /api/products (create)
- [ ] GET /api/products/:id
- [ ] PUT /api/products/:id
- [ ] DELETE /api/products/:id
- [ ] GET /api/products/low-stock

## Fase 4: Backend - Categories

- [ ] GET /api/categories
- [ ] POST /api/categories

## Fase 5: Backend - Clients

- [ ] client.service.ts
- [ ] GET /api/clients (list)
- [ ] POST /api/clients (create)
- [ ] GET /api/clients/:id (com histórico)
- [ ] PUT /api/clients/:id
- [ ] DELETE /api/clients/:id

## Fase 6: Backend - Sales

- [ ] sale.service.ts
- [ ] GET /api/sales (list)
- [ ] POST /api/sales (create + decrementar estoque)
- [ ] GET /api/sales/:id
- [ ] POST /api/sales/:id/cancel (+ devolver estoque)

## Fase 7: Backend - Reports

- [ ] report.service.ts
- [ ] GET /api/reports/summary
- [ ] GET /api/reports/by-product
- [ ] GET /api/reports/by-payment

## Fase 8: Backend - Settings

- [ ] settings.service.ts
- [ ] GET /api/settings
- [ ] PUT /api/settings
- [ ] Seed inicial de Settings

## Fase 9: Frontend - Hooks

- [ ] use-products.ts
- [ ] use-clients.ts
- [ ] use-sales.ts
- [ ] use-categories.ts
- [ ] use-settings.ts
- [ ] use-reports.ts

## Fase 10: Frontend - Layout

- [ ] Sidebar
- [ ] Header
- [ ] PageHeader
- [ ] Responsividade tablet

## Fase 11: Frontend - Estoque

- [ ] Página /estoque (lista)
- [ ] ProductTable
- [ ] ProductForm (dialog)
- [ ] Página /estoque/[id] (editar)
- [ ] LowStockAlert

## Fase 12: Frontend - Clientes

- [ ] Página /clientes (lista)
- [ ] ClientTable
- [ ] ClientForm (dialog)
- [ ] Página /clientes/[id] (detalhes + histórico)
- [ ] ClientSelect (combobox)

## Fase 13: Frontend - Vendas

- [ ] Página /vendas (lista)
- [ ] SaleTable
- [ ] Página /vendas/nova
- [ ] SaleForm
  - [ ] ItemSelector
  - [ ] PaymentForm
  - [ ] SaleSummary
- [ ] Página /vendas/[id] (detalhes)
- [ ] SaleDetails
- [ ] Botão cancelar venda

## Fase 14: Frontend - Dashboard

- [ ] Página /dashboard
- [ ] SummaryCards
- [ ] RecentSales
- [ ] LowStockList

## Fase 15: Frontend - Relatórios

- [ ] Página /relatorios
- [ ] Filtro de período
- [ ] Tabela por produto
- [ ] Tabela por forma de pagamento

## Fase 16: Frontend - Configurações

- [ ] Página /configuracoes
- [ ] Form de taxas
- [ ] Toggle de alertas

## Fase 17: Polish

- [ ] Loading states (Skeleton)
- [ ] Empty states
- [ ] Error handling (Toast)
- [ ] Confirmação de ações destrutivas
- [ ] Responsividade final

## Fase 18: Deploy

- [ ] Criar banco no Neon/Supabase
- [ ] Configurar env no Vercel
- [ ] Deploy
- [ ] Testar em tablet

---

## Dependências

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@prisma/client": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.0.0",
    "date-fns": "^3.0.0",
    "lucide-react": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "prisma": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "tailwindcss": "^3.0.0",
    "autoprefixer": "latest",
    "postcss": "latest"
  }
}
```

---

## Comandos

```bash
# Setup
npx create-next-app@14 cosmeticos-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Prisma
npm install prisma @prisma/client
npx prisma init
npx prisma migrate dev --name init
npx prisma db seed

# shadcn
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label card dialog select table badge alert toast form tabs separator dropdown-menu popover calendar command scroll-area sheet skeleton

# Outras deps
npm install @tanstack/react-query zod date-fns lucide-react
```
