'use client'

import { Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface SemanaData {
  semana: number
  mes: string
  totalVendas: number
  mediaDiaria: number
  variacao: number
}

interface MesComparacao {
  mes: string
  semanas: SemanaData[]
  total: number
}

export function RelacaoSemanalMensal() {
  const [dados, setDados] = useState<MesComparacao[]>([])
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDados() {
      try {
        const response = await fetch(`/api/relatorios/relacao-semanal-mensal?ano=${anoSelecionado}`)
        const data = await response.json()
        setDados(data)
      } catch (error) {
        console.error('Erro ao buscar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDados()
  }, [anoSelecionado])

  const anos = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Relação Semanal x Mensal
          </CardTitle>
          <CardDescription>Comparativo de vendas semanais dentro de cada mês</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = dados.flatMap((mes) =>
    mes.semanas.map((semana) => ({
      name: `${mes.mes} - S${semana.semana}`,
      vendas: semana.totalVendas,
      media: semana.mediaDiaria,
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Análise Semanal x Mensal</h3>
          <p className="text-sm text-muted-foreground">
            Comparativo de performance semanal dentro de cada mês
          </p>
        </div>
        <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o ano" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((ano) => (
              <SelectItem key={ano} value={ano}>
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução Semanal</CardTitle>
          <CardDescription>Total de vendas por semana ao longo do ano</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={12}
              />
              <YAxis />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value
                    ? value.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : 'R$ 0,00'
                }
              />
              <Bar dataKey="vendas" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {dados.map((mes) => (
          <Card key={mes.mes}>
            <CardHeader>
              <CardTitle className="text-base">{mes.mes}</CardTitle>
              <CardDescription>
                Total:{' '}
                {mes.total.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Média Diária</TableHead>
                    <TableHead>Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mes.semanas.map((semana) => (
                    <TableRow key={semana.semana}>
                      <TableCell className="font-medium">Semana {semana.semana}</TableCell>
                      <TableCell>
                        {semana.totalVendas.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </TableCell>
                      <TableCell>
                        {semana.mediaDiaria.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {semana.variacao > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : semana.variacao < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : null}
                          <span
                            className={
                              semana.variacao > 0
                                ? 'text-green-600'
                                : semana.variacao < 0
                                  ? 'text-red-600'
                                  : ''
                            }
                          >
                            {semana.variacao > 0 ? '+' : ''}
                            {semana.variacao.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0
                ? Math.max(
                    ...dados.flatMap((m) => m.semanas.map((s) => s.totalVendas))
                  ).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Maior valor de vendas em uma semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Semanal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0
                ? (
                    dados.reduce((sum, m) => sum + m.total, 0) /
                    dados.reduce((sum, m) => sum + m.semanas.length, 0)
                  ).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Média de vendas por semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ano</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados
                .reduce((sum, m) => sum + m.total, 0)
                .toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
            </div>
            <p className="text-xs text-muted-foreground">Total de vendas no ano</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
