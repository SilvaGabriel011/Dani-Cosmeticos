"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TopClientes } from "./components/top-clientes"
import { MaioresVendas } from "./components/maiores-vendas"
import { RelacaoSemanalMensal } from "./components/relacao-semanal-mensal"
import { DesempenhoMensal } from "./components/desempenho-mensal"
import { VendasPorDia } from "./components/vendas-por-dia"

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Visualize análises e estatísticas detalhadas do seu negócio
        </p>
      </div>

      <Tabs defaultValue="top-clientes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="top-clientes">Top Clientes</TabsTrigger>
          <TabsTrigger value="maiores-vendas">Maiores Vendas</TabsTrigger>
          <TabsTrigger value="relacao-semanal">Semanal x Mensal</TabsTrigger>
          <TabsTrigger value="desempenho-mensal">Desempenho Mensal</TabsTrigger>
          <TabsTrigger value="vendas-dia">Vendas por Dia</TabsTrigger>
        </TabsList>

        <TabsContent value="top-clientes">
          <TopClientes />
        </TabsContent>

        <TabsContent value="maiores-vendas">
          <MaioresVendas />
        </TabsContent>

        <TabsContent value="relacao-semanal">
          <RelacaoSemanalMensal />
        </TabsContent>

        <TabsContent value="desempenho-mensal">
          <DesempenhoMensal />
        </TabsContent>

        <TabsContent value="vendas-dia">
          <VendasPorDia />
        </TabsContent>
      </Tabs>
    </div>
  )
}
