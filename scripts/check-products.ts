import { prisma } from "../src/lib/prisma"

async function check() {
  const products = await prisma.product.count()
  const brands = await prisma.brand.count()
  const categories = await prisma.category.count()
  
  console.log("\n📦 Status dos Produtos:\n")
  console.log(`   Produtos: ${products}`)
  console.log(`   Marcas: ${brands}`)
  console.log(`   Categorias: ${categories}`)
  
  if (products > 0) {
    const sample = await prisma.product.findMany({
      take: 5,
      include: { brand: true, category: true }
    })
    console.log("\n📋 Amostra de produtos:")
    for (const p of sample) {
      console.log(`   - ${p.name} | ${p.brand?.name || 'Sem marca'} | R$ ${Number(p.salePrice).toFixed(2)}`)
    }
  }
  
  await prisma.$disconnect()
}

check().catch(console.error)
