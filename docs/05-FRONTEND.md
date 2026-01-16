# 05 - Frontend

## Páginas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | - | Redirect para `/dashboard` |
| `/dashboard` | Dashboard | Resumo geral |
| `/estoque` | Estoque | Lista de produtos |
| `/estoque/[id]` | Editar Produto | Form de edição |
| `/vendas` | Vendas | Lista de vendas |
| `/vendas/nova` | Nova Venda | Form de venda |
| `/vendas/[id]` | Detalhes Venda | Visualização |
| `/clientes` | Clientes | Lista de clientes |
| `/clientes/[id]` | Detalhes Cliente | Info + histórico |
| `/relatorios` | Relatórios | Gráficos e tabelas |
| `/configuracoes` | Configurações | Taxas e alertas |

---

## Layout

### Sidebar

```
┌────────────────────┐
│  🏪 Cosméticos     │
├────────────────────┤
│  📊 Dashboard      │
│  📦 Estoque        │
│  🛒 Vendas         │
│  👥 Clientes       │
│  📈 Relatórios     │
│  ⚙️ Configurações  │
└────────────────────┘
```

### Page Header

```
┌─────────────────────────────────────────────┐
│  Título da Página              [+ Ação]     │
│  Descrição ou breadcrumb                    │
└─────────────────────────────────────────────┘
```

---

## Componentes

### Layout

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| Sidebar | `components/layout/sidebar.tsx` | Menu lateral |
| Header | `components/layout/header.tsx` | Topo da página |
| PageHeader | `components/layout/page-header.tsx` | Título + ações |

### Products

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| ProductForm | `components/products/product-form.tsx` | Form criar/editar |
| ProductTable | `components/products/product-table.tsx` | Tabela de produtos |
| LowStockAlert | `components/products/low-stock-alert.tsx` | Banner de alerta |

### Clients

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| ClientForm | `components/clients/client-form.tsx` | Form criar/editar |
| ClientTable | `components/clients/client-table.tsx` | Tabela de clientes |
| ClientSelect | `components/clients/client-select.tsx` | Combobox de seleção |

### Sales

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| SaleForm | `components/sales/sale-form/index.tsx` | Form completo de venda |
| ItemSelector | `components/sales/sale-form/item-selector.tsx` | Adicionar itens |
| PaymentForm | `components/sales/sale-form/payment-form.tsx` | Formas de pagamento |
| SaleSummary | `components/sales/sale-form/summary.tsx` | Resumo da venda |
| SaleTable | `components/sales/sale-table.tsx` | Lista de vendas |
| SaleDetails | `components/sales/sale-details.tsx` | Visualização completa |

### Dashboard

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| SummaryCards | `components/dashboard/summary-cards.tsx` | Cards de métricas |
| RecentSales | `components/dashboard/recent-sales.tsx` | Últimas vendas |
| LowStockList | `components/dashboard/low-stock-list.tsx` | Alertas de estoque |

---

## Hooks (React Query)

### use-products.ts

```typescript
function useProducts(params?: ListParams)
function useProduct(id: string)
function useCreateProduct()
function useUpdateProduct()
function useDeleteProduct()
function useLowStockProducts()
```

### use-clients.ts

```typescript
function useClients(params?: ListParams)
function useClient(id: string, includeSales?: boolean)
function useCreateClient()
function useUpdateClient()
function useDeleteClient()
```

### use-sales.ts

```typescript
function useSales(params?: SaleListParams)
function useSale(id: string)
function useCreateSale()
function useCancelSale()
```

### use-categories.ts

```typescript
function useCategories()
function useCreateCategory()
```

### use-settings.ts

```typescript
function useSettings()
function useUpdateSettings()
```

### use-reports.ts

```typescript
function useSummary(startDate: Date, endDate: Date)
function useByProduct(startDate: Date, endDate: Date)
function useByPayment(startDate: Date, endDate: Date)
```

---

## Componentes shadcn/ui

Instalar via CLI:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label card dialog select table badge alert toast form tabs separator dropdown-menu popover calendar command scroll-area sheet skeleton
```

---

## Estados de UI

### Loading

- Usar `<Skeleton />` para loading de dados
- Usar `disabled` + spinner em botões de submit

### Empty State

- Ícone + mensagem + botão de ação
- Exemplo: "Nenhum produto cadastrado" + [Adicionar produto]

### Error State

- Toast para erros de ação
- Alert inline para erros de carregamento
