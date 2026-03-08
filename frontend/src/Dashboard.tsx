import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

const STORAGE_KEY = 'api_key'

// API Response Types
interface ScoreBucket {
  bucket: string
  count: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface TaskPassRate {
  task: string
  avg_score: number
  attempts: number
}

interface Lab {
  id: number
  title: string
}

// Chart Data Types
interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    tension?: number
    fill?: boolean
  }[]
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  )
  const [selectedLab, setSelectedLab] = useState<string>('')
  const [labs, setLabs] = useState<Lab[]>([])
  const [scores, setScores] = useState<ScoreBucket[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [passRates, setPassRates] = useState<TaskPassRate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch labs on mount
  useEffect(() => {
    if (!token) return

    const fetchLabs = async () => {
      try {
        const res = await fetch('/items/', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items = await res.json()
        const labItems = items
          .filter((item: { type: string }) => item.type === 'lab')
          .map((item: { id: number; title: string }) => ({
            id: item.id,
            title: item.title,
          }))
        setLabs(labItems)
        if (labItems.length > 0) {
          // Extract lab identifier from title (e.g., "Lab 04" → "lab-04")
          const firstLabId = labItems[0].title.toLowerCase().replace(' ', '-')
          setSelectedLab(firstLabId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch labs')
      }
    }

    fetchLabs()
  }, [token])

  // Fetch analytics data when lab changes
  useEffect(() => {
    if (!token || !selectedLab) return

    const fetchAnalytics = async () => {
      setLoading(true)
      setError(null)

      try {
        const [scoresRes, timelineRes, passRatesRes] = await Promise.all([
          fetch(`/analytics/scores?lab=${selectedLab}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/analytics/timeline?lab=${selectedLab}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/analytics/pass-rates?lab=${selectedLab}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (!scoresRes.ok) throw new Error(`Failed to fetch scores: HTTP ${scoresRes.status}`)
        if (!timelineRes.ok) throw new Error(`Failed to fetch timeline: HTTP ${timelineRes.status}`)
        if (!passRatesRes.ok) throw new Error(`Failed to fetch pass rates: HTTP ${passRatesRes.status}`)

        const scoresData: ScoreBucket[] = await scoresRes.json()
        const timelineData: TimelineEntry[] = await timelineRes.json()
        const passRatesData: TaskPassRate[] = await passRatesRes.json()

        setScores(scoresData)
        setTimeline(timelineData)
        setPassRates(passRatesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [token, selectedLab])

  // Bar chart data for score buckets
  const scoreChartData: ChartData = {
    labels: scores.map((s) => s.bucket),
    datasets: [
      {
        label: 'Number of Students',
        data: scores.map((s) => s.count),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
      },
    ],
  }

  // Line chart data for submissions timeline
  const timelineChartData: ChartData = {
    labels: timeline.map((t) => t.date),
    datasets: [
      {
        label: 'Submissions',
        data: timeline.map((t) => t.submissions),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
        fill: true,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Score Distribution' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  }

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Submissions Over Time' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  }

  if (!token) {
    return (
      <div className="dashboard-container">
        <h1>Dashboard</h1>
        <p>Please enter your API key to view analytics.</p>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <div className="lab-selector">
          <label htmlFor="lab-select">Select Lab: </label>
          <select
            id="lab-select"
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
          >
            {labs.map((lab) => (
              <option key={lab.id} value={lab.title.toLowerCase().replace(' ', '-')}>
                {lab.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading && <p className="loading">Loading analytics...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="charts-row">
            <div className="chart-card">
              <Bar data={scoreChartData} options={barChartOptions} />
            </div>
            <div className="chart-card">
              <Line data={timelineChartData} options={lineChartOptions} />
            </div>
          </div>

          <div className="table-card">
            <h2>Pass Rates per Task</h2>
            {passRates.length === 0 ? (
              <p>No data available</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Average Score</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {passRates.map((rate) => (
                    <tr key={rate.task}>
                      <td>{rate.task}</td>
                      <td>{rate.avg_score.toFixed(1)}</td>
                      <td>{rate.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default App
