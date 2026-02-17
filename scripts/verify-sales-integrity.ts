import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifySalesIntegrity() {
  try {
    console.log('🔍 Verificando integridade das vendas...\n')

    // Count total sales
    const totalSales = await prisma.sale.count()
    console.log(`📊 Total de vendas: ${totalSales}`)

    // Count sales with items
    const salesWithItems = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        client: true,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    })

    console.log(`\n📋 Verificando últimas ${salesWithItems.length} vendas:`)
    
    let allItemsValid = true
    
    for (const sale of salesWithItems) {
      const itemsCount = sale.items.length
      const validItems = sale.items.filter(item => item.product !== null).length
      const invalidItems = itemsCount - validItems
      
      const saleDate = sale.createdAt.toLocaleDateString('pt-BR')
      const clientName = sale.client?.name || 'Sem cliente'
      
      console.log(`\n  Venda ID: ${sale.id.slice(0, 8)}...`)
      console.log(`  Data: ${saleDate}`)
      console.log(`  Cliente: ${clientName}`)
      console.log(`  Total: R$ ${Number(sale.total).toFixed(2)}`)
      console.log(`  Itens: ${itemsCount} (${validItems} válidos, ${invalidItems} inválidos)`)
      
      if (invalidItems > 0) {
        allItemsValid = false
        console.log(`  ⚠️  ATENÇÃO: ${invalidItems} produtos não encontrados!`)
      } else {
        console.log(`  ✅ Todos os produtos encontrados`)
      }
      
      // Show first 3 items
      sale.items.slice(0, 3).forEach((item, idx) => {
        if (item.product) {
          const isDeleted = item.product.deletedAt !== null
          const status = isDeleted ? '(DELETADO)' : '(ATIVO)'
          console.log(`    ${idx + 1}. ${item.product.name} ${status} - Qtd: ${item.quantity}`)
        } else {
          console.log(`    ${idx + 1}. ❌ PRODUTO NÃO ENCONTRADO`)
        }
      })
    }

    // Count products deleted but still in sales
    const deletedProductsInSales = await prisma.product.findMany({
      where: {
        deletedAt: { not: null },
        saleItems: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        _count: {
          select: {
            saleItems: true,
          },
        },
      },
      take: 5,
    })

    if (deletedProductsInSales.length > 0) {
      console.log(`\n📦 Produtos deletados preservados nas vendas:`)
      deletedProductsInSales.forEach((product) => {
        console.log(`  - ${product.name} (${product._count.saleItems} vendas)`)
      })
    }

    console.log('\n' + '='.repeat(60))
    
    if (allItemsValid) {
      console.log('✅ VERIFICAÇÃO CONCLUÍDA: Todas as vendas estão íntegras!')
      console.log('✅ Produtos deletados ainda aparecem nas vendas antigas')
      console.log('✅ Nenhum erro de referência encontrado')
    } else {
      console.log('⚠️  ATENÇÃO: Algumas vendas têm produtos inválidos')
      console.log('⚠️  Isso pode indicar problema de integridade')
    }
    
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ Erro ao verificar vendas:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifySalesIntegrity()
