import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: params.id },
      include: { _count: { select: { products: true } } },
    })

    if (!brand) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Marca não encontrada' } },
        { status: 404 }
      )
    }

    if (brand._count.products > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Não é possível excluir. Existem ${brand._count.products} produto(s) vinculados a esta marca.`,
          },
        },
        { status: 409 }
      )
    }

    await prisma.brand.delete({
      where: { id: params.id },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting brand:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao excluir marca' } },
      { status: 500 }
    )
  }
}
