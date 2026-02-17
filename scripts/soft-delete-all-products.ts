import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function softDeleteAllProducts() {
  try {
    console.log('🔄 Iniciando soft delete de todos os produtos...')
    
    const result = await prisma.product.updateMany({
      where: {
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    console.log(`✅ ${result.count} produtos marcados como deletados`)
    console.log('ℹ️  Produtos serão reativados automaticamente se estiverem na nova planilha')
    
  } catch (error) {
    console.error('❌ Erro ao executar soft delete:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

softDeleteAllProducts()
