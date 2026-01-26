'use client'

import { TrendingUp, TrendingDown, DollarSign, Target, Activity } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
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

interface MesData {
  mes: string
  total: number
  vendas: number
  ticketMedio: number
  meta: number
  atingimentoMeta: number
  variacao: number
}

export function DesempenhoMensal() {
  const [dados, setDados] = useState<MesData[]>([])
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDados() {
      try {
        const response = await fetch(`/api/relatorios/desempenho-mensal?ano=${anoSelecionado}`)
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
            <Activity className="h-5 w-5" />
            Desempenho Mensal
          </CardTitle>
          <CardDescription>Análise de performance mensal do ano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full" />
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = dados.map((mes) => ({
    name: mes.mes,
    vendas: mes.total,
    meta: mes.meta,
    ticket: mes.ticketMedio,
  }))

  const chartDataVariacao = dados.map((mes) => ({
    name: mes.mes,
    variacao: mes.variacao,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Desempenho Mensal</h3>
          <p className="text-sm text-muted-foreground">Análise completa de performance por mês</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas x Meta</CardTitle>
            <CardDescription>Comparativo entre vendas realizadas e metas mensais</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
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
                <Bar dataKey="vendas" fill="#8884d8" name="Vendas" />
                <Bar dataKey="meta" fill="#82ca9d" name="Meta" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variação Mensal</CardTitle>
            <CardDescription>Percentual de crescimento ou queda mês a mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartDataVariacao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number | undefined) => [
                    value ? `${value.toFixed(1)}%` : '0%',
                    'Variação',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="variacao"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ fill: '#8884d8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução do Ticket Médio</CardTitle>
          <CardDescription>Valor médio por venda ao longo do ano</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
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
              <Area
                type="monotone"
                dataKey="ticket"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dados.map((mes) => (
          <Card key={mes.mes}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{mes.mes}</CardTitle>
              <div className="flex items-center gap-1">
                {mes.variacao > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : mes.variacao < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : null}
                <span
                  className={`text-xs ${mes.variacao > 0 ? 'text-green-600' : mes.variacao < 0 ? 'text-red-600' : ''}`}
                >
                  {mes.variacao > 0 ? '+' : ''}
                  {mes.variacao.toFixed(1)}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                  <p className="text-lg font-bold">
                    {mes.total.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Meta:</span>
                  <span>{(mes.atingimentoMeta * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      mes.atingimentoMeta >= 1
                        ? 'bg-green-600'
                        : mes.atingimentoMeta >= 0.8
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(mes.atingimentoMeta * 100, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0
                ? Math.max(...dados.map((d) => d.total)).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {dados.find((d) => d.total === Math.max(...dados.map((d) => d.total)))?.mes || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0
                ? (dados.reduce((sum, d) => sum + d.total, 0) / dados.length).toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    }
                  )
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Média de vendas por mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Anual</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0
                ? (
                    (dados.reduce((sum, d) => sum + d.atingimentoMeta, 0) / dados.length) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Média de atingimento de meta</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
