import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function revertWallisonFix() {
  const saleId = '4f633b91-ba0c-4833-839b-cfb4b028df1c'

  try {
    console.log('\n🔄 Revertendo correção incorreta do Wallison...\n')

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: 139.50,
      },
    })

    console.log('✅ Revertido para paidAmount = R$ 139.50')
    console.log('✅ Saldo devedor voltou para R$ 140.50')
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

revertWallisonFix()
