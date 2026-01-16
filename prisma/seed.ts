import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Create default settings
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      debitFeePercent: 1.5,
      creditFeePercent: 3.0,
      creditInstallmentFee: 4.0,
      defaultFeeAbsorber: "SELLER",
      lowStockAlertEnabled: true,
    },
  })

  console.log("✅ Settings created")

  // Create some sample categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Maquiagem" },
      update: {},
      create: { name: "Maquiagem" },
    }),
    prisma.category.upsert({
      where: { name: "Skincare" },
      update: {},
      create: { name: "Skincare" },
    }),
    prisma.category.upsert({
      where: { name: "Cabelos" },
      update: {},
      create: { name: "Cabelos" },
    }),
    prisma.category.upsert({
      where: { name: "Perfumaria" },
      update: {},
      create: { name: "Perfumaria" },
    }),
  ])

  console.log(`✅ ${categories.length} categories created`)

  // Create default brands
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { name: "Eudora" },
      update: {},
      create: { name: "Eudora" },
    }),
    prisma.brand.upsert({
      where: { name: "Natura" },
      update: {},
      create: { name: "Natura" },
    }),
    prisma.brand.upsert({
      where: { name: "Boticário" },
      update: {},
      create: { name: "Boticário" },
    }),
    prisma.brand.upsert({
      where: { name: "Romanel" },
      update: {},
      create: { name: "Romanel" },
    }),
  ])

  console.log(`✅ ${brands.length} brands created`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
