import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function reactivateAllProducts() {
  try {
    console.log('🔄 Reativando todos os produtos deletados...')
    
    const result = await prisma.product.updateMany({
      where: {
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
        isActive: true,
      },
    })

    console.log(`✅ ${result.count} produtos reativados`)
    console.log('ℹ️  Todos os produtos voltaram a estar ativos no sistema')
    
  } catch (error) {
    console.error('❌ Erro ao reativar produtos:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

reactivateAllProducts()
