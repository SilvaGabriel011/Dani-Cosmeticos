'use client'

import { TrendingUp, Package, DollarSign, Calendar } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Venda {
  id: string
  idVenda: string
  nomeCliente: string
  produtos: number
  total: number
  data: string
  vendedor: string
}

export function MaioresVendas() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMaioresVendas() {
      try {
        const response = await fetch('/api/relatorios/maiores-vendas')
        const data = await response.json()
        setVendas(data)
      } catch (error) {
        console.error('Erro ao buscar maiores vendas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMaioresVendas()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Maiores Vendas
          </CardTitle>
          <CardDescription>Vendas de maior valor do período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[300px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-600" />
            Top 20 Maiores Vendas
          </CardTitle>
          <CardDescription>Vendas de maior valor dos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posição</TableHead>
                <TableHead>ID Venda</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Vendedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((venda, index) => (
                <TableRow key={venda.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index < 3 && (
                        <Badge
                          variant={index === 0 ? 'default' : index === 1 ? 'secondary' : 'outline'}
                        >
                          {index + 1}º
                        </Badge>
                      )}
                      {index >= 3 && <span className="text-muted-foreground">{index + 1}º</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">#{venda.idVenda}</TableCell>
                  <TableCell>{venda.nomeCliente}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      {venda.produtos}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-600">
                        {venda.total.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      {new Date(venda.data).toLocaleDateString('pt-BR')}
                    </div>
                  </TableCell>
                  <TableCell>{venda.vendedor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Venda</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendas[0]?.total.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }) || '-'}
            </div>
            <p className="text-sm text-muted-foreground">Venda #{vendas[0]?.idVenda || '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendas.length > 0
                ? (vendas.reduce((sum, v) => sum + v.total, 0) / vendas.length).toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    }
                  )
                : '-'}
            </div>
            <p className="text-sm text-muted-foreground">Média das top 20 vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Top 20</CardTitle>
            <Package className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendas
                .reduce((sum, v) => sum + v.total, 0)
                .toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
            </div>
            <p className="text-sm text-muted-foreground">Soma das top 20 vendas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
