# Plano de Melhorias UI/UX — Dani Cosmeticos

## Contexto
O usuario-alvo nao e familiarizado com tecnologia. O sistema precisa ser intuitivo, com linguagem clara e fluxos simples. Este documento detalha cada melhoria identificada, o problema atual, a solucao proposta e os arquivos impactados.

---

## 1. Navegacao Mobile — Bottom Tab Bar
**Prioridade: ALTA**

### Problema Atual
- O menu mobile e uma barra horizontal com scroll que so aparece ao clicar no hamburger
- 7 itens de navegacao comprimidos horizontalmente
- Nao segue o padrao mental do usuario (WhatsApp, Instagram usam bottom bar)

### Solucao
Substituir o menu mobile por uma **barra de navegacao fixa no rodape (bottom tab bar)** com os 4-5 itens mais usados:
- Inicio (Dashboard)
- Vendas
- Estoque
- Clientes
- Mais (abre menu com Devedores, Relatorios, Configuracoes)

### Arquivos Impactados
- `src/components/layout/sidebar.tsx` — Adicionar bottom bar para mobile, manter sidebar para desktop
- `src/app/(main)/layout.tsx` — Ajustar padding inferior para nao sobrepor conteudo

### Detalhes Tecnicos
- Bottom bar fixa com `fixed bottom-0` no mobile (`md:hidden`)
- Icones com labels abaixo (texto curto)
- Item ativo destacado com cor primaria
- Botao "Mais" abre sheet/popover com itens restantes
- Altura de ~64px com safe area para dispositivos com notch
- Adicionar `pb-20` no main content para compensar a barra

---

## 2. Formulario de Venda como Wizard/Stepper
**Prioridade: ALTA**

### Problema Atual
- Componente SaleForm tem 2110 linhas e mostra tudo de uma vez
- 3 colunas simultaneas (Produtos, Cliente/Resumo, Pagamento)
- Configuracao de fiado com muitos campos visiveis ao mesmo tempo
- Sem indicacao de progresso — usuario nao sabe onde esta no fluxo

### Solucao
Transformar em fluxo por etapas no mobile:
- **Passo 1:** Selecionar produtos (busca + carrinho)
- **Passo 2:** Selecionar cliente + desconto
- **Passo 3:** Forma de pagamento (Pagar Agora ou Fiado + config parcelas)
- **Passo 4:** Resumo final + Confirmar

No desktop, manter o layout de colunas mas adicionar indicador de progresso visual no topo.

### Arquivos Impactados
- `src/components/sales/sale-form.tsx` — Refatorar para wizard no mobile

### Detalhes Tecnicos
- Barra de progresso no topo do dialog: 4 circulos conectados por linhas
- Botoes "Proximo" e "Voltar" grandes e visiveis
- Validacao por etapa (ex: nao avanca sem produto no carrinho)
- No mobile: mostrar apenas 1 step por vez (full width)
- No desktop (md+): manter layout atual de colunas com indicador de step no topo
- Resumo no passo final mostra tudo antes de confirmar

---

## 3. Cards no Mobile (substituir tabelas)
**Prioridade: ALTA**

### Problema Atual
- Tabelas HTML escondem colunas no celular com `hidden sm:table-cell`
- Informacoes criticas ficam invisiveis no mobile
- Botoes de acao sao apenas icones sem texto

### Solucao
No mobile (<md), renderizar **cards empilhados** ao inves de tabelas:
- Cada card mostra informacoes essenciais do item
- Botoes de acao com texto + icone
- Layout adaptado para toque (min 44px de altura nos alvos)

### Arquivos Impactados
- `src/components/products/product-list.tsx` — Card view para mobile
- `src/components/clients/client-list.tsx` — Card view para mobile
- `src/components/dashboard/fiado-table.tsx` — Card view para mobile

### Detalhes Tecnicos
- Usar `hidden md:block` na tabela e `md:hidden` nos cards
- Card de produto: Nome, Preco, Estoque (badge colorido), botoes Editar/Excluir
- Card de cliente: Nome, Telefone (com link WhatsApp), botoes
- Card de fiado: Cliente, Valor restante, Vencimento, barra de progresso, botoes Pagar/WhatsApp
- Swipe actions opcional (futuro)

---

## 4. Botao Flutuante "Nova Venda" no Mobile
**Prioridade: MEDIA**

### Problema Atual
- Botao "Nova Venda" fica no canto superior e e pequeno
- E a acao mais frequente do sistema mas nao se destaca

### Solucao
Adicionar um **Floating Action Button (FAB)** grande no mobile:
- Fixo no canto inferior direito, acima da bottom bar
- Cor primaria, icone de "+" ou carrinho
- Visivel em todas as paginas principais

### Arquivos Impactados
- `src/app/(main)/layout.tsx` — Adicionar FAB
- `src/app/(main)/dashboard/page.tsx` — Coordenar com botoes existentes

### Detalhes Tecnicos
- `fixed bottom-20 right-4 z-50 md:hidden`
- Botao circular de 56px com sombra
- Abre o SaleForm ao clicar
- Animacao de scale ao aparecer
- Esconder quando SaleForm estiver aberto

---

## 5. Empty States com Orientacao
**Prioridade: MEDIA**

### Problema Atual
- Estados vazios mostram apenas "Nenhum produto encontrado"
- Sem guiar o usuario sobre o que fazer

### Solucao
Empty states com:
- Icone grande e amigavel
- Texto explicativo claro
- Botao de acao direto

### Arquivos Impactados
- `src/components/products/product-list.tsx`
- `src/components/clients/client-list.tsx`
- `src/components/dashboard/fiado-table.tsx`
- `src/components/sales/sale-list.tsx` (se existir)

### Detalhes Tecnicos
- Componente reutilizavel `EmptyState` com props: icon, title, description, actionLabel, onAction
- Exemplos:
  - Produtos: "Voce ainda nao cadastrou nenhum produto" + "Cadastrar produto" / "Importar planilha"
  - Clientes: "Nenhum cliente cadastrado ainda" + "Adicionar cliente"
  - Fiado: "Nenhuma venda fiado pendente" + "Nova venda"
  - Filtros sem resultado: "Nenhum resultado para esses filtros" + "Limpar filtros"

---

## 6. Terminologia e Labels Claras
**Prioridade: MEDIA**

### Problema Atual
- Abreviacoes: "Enc.", "Parc.", "venc." — confusas para leigos
- "Fiado" sem explicacao, "Itens Zerados" sem contexto
- Headers de tabela abreviados

### Solucao
- Usar nomes completos sempre que possivel
- Adicionar subtitulos explicativos nas tabs e secoes
- No mobile, labels completas nos botoes

### Arquivos Impactados
- `src/components/dashboard/fiado-table.tsx` — Headers e labels
- `src/app/(main)/estoque/page.tsx` — Descricoes nas tabs
- `src/app/(main)/dashboard/page.tsx` — Descricoes nas tabs
- Varios componentes com abreviacoes

### Mudancas Especificas
- "Parc." → "Parcelas"
- "Venc." → "Vencimento"
- "Enc." → "Encomenda"
- Tab "Fiado" → subtitulo "Vendas a prazo com pagamento pendente"
- Tab "Estoque" → subtitulo "Produtos que precisam de atencao"
- "Itens Zerados" → "Sem Estoque"
- "Sem Valor" → "Sem Preco"
- Badge "venc." → "vencidos"

---

## 7. Feedback Visual Apos Acoes
**Prioridade: MEDIA**

### Problema Atual
- Apos criar venda ou registrar pagamento, so aparece toast pequeno
- Toast desaparece rapido, usuario pode nao ver

### Solucao
Apos acoes importantes, mostrar **tela de sucesso** temporaria:
- Icone de check animado
- Resumo do que foi feito
- Botoes para proxima acao

### Arquivos Impactados
- `src/components/sales/sale-form.tsx` — Tela de sucesso apos venda
- `src/components/dashboard/receivable-payment-modal.tsx` — Tela de sucesso apos pagamento

### Detalhes Tecnicos
- Componente `SuccessScreen` reutilizavel
- Animacao de check com CSS (scale + fade in)
- Auto-fecha apos 3 segundos ou ao clicar
- Mostra resumo: "Venda de R$ X para [Cliente] registrada!"
- Botoes: "Nova venda" / "Voltar ao inicio"

---

## 8. Simplificar Formulario de Produto
**Prioridade: MEDIA-BAIXA**

### Problema Atual
- Radio buttons "Modo de Precificacao" (Margem vs Preco de Venda) confuso
- Campos como "Margem de Lucro" e "Estoque Minimo" sem explicacao
- Muitos campos visiveis de uma vez

### Solucao
- Por padrao mostrar apenas campos essenciais: Nome, Preco de Custo, Preco de Venda, Estoque
- Esconder campos avancados (Margem, Codigo, Estoque Minimo) em secao colapsavel "Opcoes avancadas"
- Adicionar dicas inline nos campos

### Arquivos Impactados
- `src/components/products/product-form.tsx`

### Detalhes Tecnicos
- Campos essenciais sempre visiveis: Nome, Categoria, Marca, Custo, Preco de Venda, Estoque
- Secao "Opcoes avancadas" colapsavel: Codigo, Estoque Minimo, Modo Margem
- Dicas: "Preco de Custo: quanto voce pagou pelo produto", "Estoque Minimo: quantidade minima antes de avisar reposicao"

---

## 9. Consolidar Tabs do Estoque
**Prioridade: BAIXA**

### Problema Atual
- 5 tabs (Todos, Faltantes, Sem Valor, Encomendas, Itens Zerados) — muita opcao
- No mobile, tabs transbordam e requerem scroll horizontal

### Solucao
Reduzir para 3 tabs:
- **Todos** — Lista completa
- **Alertas** — Agrupa Faltantes + Sem Preco + Sem Estoque com sub-filtros visuais
- **Encomendas** — Pedidos pendentes

### Arquivos Impactados
- `src/app/(main)/estoque/page.tsx`
- `src/components/products/product-list.tsx`

---

## 10. Acessibilidade — Cor + Texto + Icone
**Prioridade: BAIXA**

### Problema Atual
- Status de estoque usa apenas cores (badge verde/amarelo/vermelho)
- Vencimentos atrasados usam "!" como unico indicador
- Daltonicos ou usuarios com tela de baixa qualidade podem nao distinguir

### Solucao
Sempre usar **cor + icone + texto** juntos:
- Estoque baixo: icone alerta + "Baixo" + cor vermelha
- Vencido: icone calendario + "X dias atrasado" + cor vermelha
- Em dia: icone check + "Em dia" + cor verde

### Arquivos Impactados
- `src/components/products/product-list.tsx`
- `src/components/dashboard/fiado-table.tsx`
- `src/lib/utils.ts` — funcao getStockStatus

---

## Resumo da Ordem de Implementacao

| # | Melhoria | Prioridade | Impacto |
|---|----------|-----------|---------|
| 1 | Navegacao Mobile (bottom bar) | ALTA | Toda experiencia mobile |
| 2 | SaleForm wizard/stepper | ALTA | Fluxo principal |
| 3 | Cards no mobile | ALTA | Legibilidade |
| 4 | Botao flutuante Nova Venda | MEDIA | Acao mais frequente |
| 5 | Empty states | MEDIA | Primeira experiencia |
| 6 | Terminologia clara | MEDIA | Compreensao geral |
| 7 | Feedback visual | MEDIA | Confianca do usuario |
| 8 | Simplificar form produto | MEDIA-BAIXA | Cadastro |
| 9 | Consolidar tabs estoque | BAIXA | Organizacao |
| 10 | Acessibilidade cor+texto | BAIXA | Inclusao |
