import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { useThemeStore } from '@/stores/themeStore'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

interface ChartProps {
  labels: string[]
  datasets: { label: string; data: number[]; color?: string }[]
  type?: 'line' | 'bar'
  title?: string
}

export function StatsChart({ labels, datasets, type = 'line', title }: ChartProps) {
  const theme = useThemeStore((s) => s.theme)
  const textColor = theme === 'dark' ? '#e5e5e5' : '#171717'
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const palette = ['#ff4060', '#3b82f6', '#22c55e', '#f59e0b']

  const data = {
    labels,
    datasets: datasets.map((d, i) => ({
      label: d.label,
      data: d.data,
      borderColor: d.color ?? palette[i % palette.length],
      backgroundColor: type === 'bar' ? d.color ?? palette[i % palette.length] : (d.color ?? palette[i % palette.length]) + '33',
      fill: type === 'line',
      tension: 0.3,
    })),
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor } },
      title: title ? { display: true, text: title, color: textColor } : { display: false },
    },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true },
    },
  }

  return (
    <div className="h-72">
      {type === 'line' ? <Line data={data} options={options} /> : <Bar data={data} options={options} />}
    </div>
  )
}
