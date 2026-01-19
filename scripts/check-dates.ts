import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const saleItemCount = await prisma.saleItem.count()
  console.log("Total de itens de venda (SaleItem):", saleItemCount)
  
  const salesCount = await prisma.sale.count()
  console.log("Total de vendas (Sale):", salesCount)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
