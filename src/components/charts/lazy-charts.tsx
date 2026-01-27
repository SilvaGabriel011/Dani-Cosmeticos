'use client'

import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/skeleton'

const ChartSkeleton = () => (
  <div className="w-full h-[300px] flex items-center justify-center">
    <Skeleton className="w-full h-full" />
  </div>
)

export const LazyBarChart = dynamic(
  () => import('./bar-chart').then((mod) => mod.BarChart),
  {
    ssr: false,
    loading: ChartSkeleton,
  }
)

export const LazyLineChart = dynamic(
  () => import('./line-chart').then((mod) => mod.LineChart),
  {
    ssr: false,
    loading: ChartSkeleton,
  }
)

export const LazyPieChart = dynamic(
  () => import('./pie-chart').then((mod) => mod.PieChart),
  {
    ssr: false,
    loading: ChartSkeleton,
  }
)
