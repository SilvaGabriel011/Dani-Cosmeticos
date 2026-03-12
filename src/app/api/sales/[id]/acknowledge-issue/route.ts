import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST - Acknowledge an issue for a sale
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: saleId } = await params
    const body = await request.json()
    const { issueCode, notes } = body

    if (!issueCode || typeof issueCode !== 'string') {
      return NextResponse.json(
        { error: { message: 'issueCode é obrigatório', code: 'VALIDATION' } },
        { status: 400 }
      )
    }

    // Verify sale exists
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true },
    })

    if (!sale) {
      return NextResponse.json(
        { error: { message: 'Venda não encontrada', code: 'NOT_FOUND' } },
        { status: 404 }
      )
    }

    // Upsert the acknowledged issue
    const acknowledged = await prisma.acknowledgedIssue.upsert({
      where: {
        saleId_issueCode: { saleId, issueCode },
      },
      create: {
        saleId,
        issueCode,
        notes: notes || null,
      },
      update: {
        notes: notes || null,
        acknowledgedAt: new Date(),
      },
    })

    return NextResponse.json(acknowledged)
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}

// DELETE - Remove acknowledge from an issue
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: saleId } = await params
    const { searchParams } = new URL(request.url)
    const issueCode = searchParams.get('issueCode')

    if (!issueCode) {
      return NextResponse.json(
        { error: { message: 'issueCode é obrigatório', code: 'VALIDATION' } },
        { status: 400 }
      )
    }

    await prisma.acknowledgedIssue.deleteMany({
      where: { saleId, issueCode },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}

// GET - List all acknowledged issues for a sale
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: saleId } = await params

    const acknowledged = await prisma.acknowledgedIssue.findMany({
      where: { saleId },
      orderBy: { acknowledgedAt: 'desc' },
    })

    return NextResponse.json(acknowledged)
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
