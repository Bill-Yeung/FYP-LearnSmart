import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'

interface PatternStats {
  by_category: { error_category: string; category_label: string | null; count: number }[]
  by_topic: { topic: string; count: number }[]
  weekly: { day: string; count: number }[]
}

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
]

function DonutChart({
  data,
}: {
  data: PatternStats['by_category']
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const total = data.reduce((s, d) => s + d.count, 0)

  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const el = ref.current
    const size = 220
    const radius = size / 2
    const inner = radius * 0.56

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${size} ${size}`)
      .attr('width', '100%')

    const g = svg.append('g').attr('transform', `translate(${radius},${radius})`)

    const pie = d3.pie<PatternStats['by_category'][0]>()
      .value(d => d.count)
      .sort(null)
      .padAngle(0.025)

    const arc = d3.arc<d3.PieArcDatum<PatternStats['by_category'][0]>>()
      .innerRadius(inner)
      .outerRadius(radius - 4)
      .cornerRadius(4)

    const arcHover = d3.arc<d3.PieArcDatum<PatternStats['by_category'][0]>>()
      .innerRadius(inner)
      .outerRadius(radius)
      .cornerRadius(4)

    const arcs = pie(data)

    g.selectAll('path')
      .data(arcs)
      .enter()
      .append('path')
      .attr('d', arc as never)
      .attr('fill', (_, i) => PALETTE[i % PALETTE.length])
      .attr('opacity', 0.85)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 0.15s')
      .on('mouseover', function (event, d) {
        void event
        d3.select(this).attr('d', arcHover as never).attr('opacity', 1)
        setHovered(d.data.category_label ?? d.data.error_category ?? 'Unknown')
      })
      .on('mouseout', function () {
        d3.select(this).attr('d', arc as never).attr('opacity', 0.85)
        setHovered(null)
      })

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('font-size', '26px')
      .attr('font-weight', '700')
      .attr('fill', 'currentColor')
      .text(total)

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('font-size', '11px')
      .attr('fill', '#9ca3af')
      .text('errors')
  }, [data, total])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[220px]">
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 rounded px-2 py-0.5 shadow">
              {hovered}
            </span>
          </div>
        )}
        <svg ref={ref} className="text-gray-900 dark:text-gray-100" />
      </div>
      <div className="w-full space-y-1.5">
        {data.map((d, i) => (
          <div key={d.error_category ?? i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300">
              {d.category_label ?? d.error_category ?? 'Uncategorised'}
            </span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopicBars({ data }: { data: PatternStats['by_topic'] }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const el = ref.current
    const w = el.parentElement?.clientWidth ?? 400
    const barH = 26
    const gap = 6
    const labelW = 130
    const countW = 28
    const barW = w - labelW - countW - 12
    const h = data.length * (barH + gap)

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%')

    const max = d3.max(data, d => d.count) ?? 1

    const xScale = d3.scaleLinear().domain([0, max]).range([0, barW])

    const g = svg.append('g')

    data.forEach((d, i) => {
      const y = i * (barH + gap)
      const row = g.append('g').attr('transform', `translate(0,${y})`)

      row.append('text')
        .attr('x', labelW - 8)
        .attr('y', barH / 2 + 1)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#6b7280')
        .text(d.topic.length > 18 ? d.topic.slice(0, 17) + '…' : d.topic)

      row.append('rect')
        .attr('x', labelW)
        .attr('y', 0)
        .attr('width', barW)
        .attr('height', barH)
        .attr('rx', 6)
        .attr('fill', '#f3f4f6')

      row.append('rect')
        .attr('x', labelW)
        .attr('y', 0)
        .attr('height', barH)
        .attr('rx', 6)
        .attr('fill', PALETTE[i % PALETTE.length])
        .attr('opacity', 0.82)
        .attr('width', 0)
        .transition()
        .duration(600)
        .delay(i * 60)
        .ease(d3.easeCubicOut)
        .attr('width', xScale(d.count))

      row.append('text')
        .attr('x', labelW + barW + 6)
        .attr('y', barH / 2 + 1)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#6b7280')
        .text(d.count)
    })
  }, [data])

  return <svg ref={ref} className="w-full" />
}

function CalendarHeatmap({ data }: { data: PatternStats['weekly'] }) {
  const ref = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current

    const today = new Date()
    const days: { date: string; count: number }[] = []
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const found = data.find(x => x.day === key)
      days.push({ date: key, count: found?.count ?? 0 })
    }

    const cellSize = 28
    const gap = 4
    const cols = 7
    const rows = Math.ceil(days.length / cols)
    const w = cols * (cellSize + gap) - gap
    const h = rows * (cellSize + gap) - gap + 20

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%')

    const max = d3.max(days, d => d.count) ?? 1
    const colorScale = d3.scaleSequential()
      .domain([0, max])
      .interpolator(d3.interpolate('#f3f4f6', '#6366f1'))

    days.forEach((d, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = col * (cellSize + gap)
      const y = row * (cellSize + gap)
      const dateObj = new Date(d.date + 'T00:00:00')
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      svg.append('rect')
        .attr('x', x).attr('y', y)
        .attr('width', cellSize).attr('height', cellSize)
        .attr('rx', 6)
        .attr('fill', d.count === 0 ? '#f3f4f6' : colorScale(d.count))
        .style('cursor', 'pointer')
        .on('mousemove', (event: MouseEvent) => {
          const rect = el.getBoundingClientRect()
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 36,
            text: `${label}: ${d.count} error${d.count !== 1 ? 's' : ''}`,
          })
        })
        .on('mouseleave', () => setTooltip(null))

      if (d.count > 0) {
        svg.append('text')
          .attr('x', x + cellSize / 2).attr('y', y + cellSize / 2 + 1)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('font-size', '10px').attr('font-weight', '600')
          .attr('fill', d.count > max * 0.5 ? '#fff' : '#4b5563')
          .text(d.count)
      }
    })

    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    dayNames.forEach((name, i) => {
      svg.append('text')
        .attr('x', i * (cellSize + gap) + cellSize / 2)
        .attr('y', h - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#9ca3af')
        .text(name)
    })
  }, [data])

  return (
    <div className="relative">
      {tooltip && (
        <div
          className="absolute z-10 rounded-lg bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      <svg ref={ref} className="w-full" />
    </div>
  )
}

function StatsBar({ data, totalErrors }: { data: PatternStats['weekly']; totalErrors: number }) {
  const dataMap = new Map(data.map(d => [d.day, d.count]))

  let streak = 0
  for (let i = 0; i < 28; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if ((dataMap.get(key) ?? 0) > 0) streak++
    else break
  }

  const last28Total = data.reduce((s, d) => s + d.count, 0)
  const peak = data.reduce((m, d) => Math.max(m, d.count), 0)
  const activeDays = data.filter(d => d.count > 0).length

  const stats = [
    { label: 'Total errors', value: totalErrors, color: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Last 28 days', value: last28Total, color: 'text-rose-500 dark:text-rose-400' },
    { label: 'Active days', value: activeDays, color: 'text-amber-500 dark:text-amber-400' },
    { label: 'Peak / day', value: peak, color: 'text-purple-500 dark:text-purple-400' },
    { label: 'Day streak', value: streak, color: 'text-emerald-600 dark:text-emerald-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ data }: { data: PatternStats['weekly'] }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || data.length < 2) return
    const el = ref.current
    const w = 120, h = 36

    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h)

    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, w])
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) ?? 1]).range([h - 4, 4])

    const line = d3.line<{ day: string; count: number }>()
      .x((_, i) => x(i))
      .y(d => y(d.count))
      .curve(d3.curveCatmullRom)

    const area = d3.area<{ day: string; count: number }>()
      .x((_, i) => x(i))
      .y0(h)
      .y1(d => y(d.count))
      .curve(d3.curveCatmullRom)

    svg.append('path').datum(data)
      .attr('d', area as never)
      .attr('fill', '#6366f1')
      .attr('opacity', 0.15)

    svg.append('path').datum(data)
      .attr('d', line as never)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2)
  }, [data])

  return <svg ref={ref} />
}

type Suggestion = {
  title: string
  detail: string
  action: string
  href: string
  urgency: 'high' | 'medium' | 'low'
}

const CATEGORY_ADVICE: Record<string, { action: string; detail: string }> = {
  conceptual: {
    action: 'Use Feynman teach-back',
    detail: 'You have many conceptual errors. Try explaining each concept out loud in your own words to expose gaps.',
  },
  calculation: {
    action: 'Practice worked examples',
    detail: 'Calculation errors suggest a step is being skipped. Work through similar problems slowly, writing every step.',
  },
  memory: {
    action: 'Create flashcards',
    detail: 'Recall errors are best fixed with spaced repetition. Add these items to your flashcard deck and review daily.',
  },
  application: {
    action: 'Do applied practice questions',
    detail: 'You struggle applying knowledge to new problems. Practise past paper questions under timed conditions.',
  },
  careless: {
    action: 'Slow down and check work',
    detail: 'Many careless mistakes detected. Try a final check step before submitting answers.',
  },
  understanding: {
    action: 'Re-read and take structured notes',
    detail: 'Comprehension errors mean the material needs another pass. Re-read the source with active note-taking.',
  },
}

function buildSuggestions(patterns: PatternStats, totalErrors: number): Suggestion[] {
  const suggestions: Suggestion[] = []
  const threshold = Math.max(2, totalErrors * 0.15) // flag if ≥ 15% share or ≥ 2 errors

  for (const cat of patterns.by_category) {
    if (cat.count < threshold) continue
    const pct = Math.round((cat.count / totalErrors) * 100)
    const key = (cat.error_category ?? '').toLowerCase()
    const label = cat.category_label ?? cat.error_category ?? 'Unknown'
    const advice = CATEGORY_ADVICE[key]

    if (advice) {
      suggestions.push({
        urgency: pct >= 40 ? 'high' : pct >= 25 ? 'medium' : 'low',
        title: `${pct}% of your errors are "${label}"`,
        detail: advice.detail,
        action: advice.action,
        href: key === 'memory' ? '/flashcards/review'
          : key === 'conceptual' ? '/application/teach-back'
          : key === 'application' || key === 'calculation' ? '/application/practice-exam'
          : '/application/schedule-review',
      })
    } else {
      suggestions.push({
        urgency: pct >= 40 ? 'high' : 'medium',
        title: `${pct}% of your errors fall under "${label}"`,
        detail: `This category has a high share of your total errors. Focus your next study session specifically on this area.`,
        action: 'Review these errors',
        href: '/application/schedule-review',
      })
    }
  }

  const topTopic = patterns.by_topic[0]
  if (topTopic && topTopic.count >= threshold) {
    suggestions.push({
      urgency: 'medium',
      title: `"${topTopic.topic}" is your weakest topic`,
      detail: `You have ${topTopic.count} logged error${topTopic.count !== 1 ? 's' : ''} in this topic. Target it directly with focused review and practice questions.`,
      action: 'Open progress overview',
      href: '/progress/analytics',
    })
  }

  const activeDays = patterns.weekly.filter(d => d.count > 0).length
  if (activeDays <= 3 && totalErrors > 0) {
    suggestions.push({
      urgency: 'medium',
      title: 'Low review activity in the last 28 days',
      detail: `You only logged errors on ${activeDays} day${activeDays !== 1 ? 's' : ''} recently. Regular short sessions are more effective than occasional long ones.`,
      action: 'Start a review session',
      href: '/application/schedule-review',
    })
  }

  if (totalErrors >= 20) {
    const unmastered = totalErrors
    suggestions.push({
      urgency: 'low',
      title: `${unmastered} errors in your log`,
      detail: 'Your error book has grown. Work through due items in batches using the schedule review, rather than all at once.',
      action: 'Open schedule review',
      href: '/application/schedule-review',
    })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return suggestions.sort((a, b) => order[a.urgency] - order[b.urgency]).slice(0, 5)
}

const URGENCY_STYLE = {
  high: {
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-900/20',
    badge: 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'text-red-800 dark:text-red-200',
    detail: 'text-red-600 dark:text-red-400',
    btn: 'bg-red-600 hover:bg-red-700 text-white',
  },
  medium: {
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    badge: 'bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'text-amber-800 dark:text-amber-200',
    detail: 'text-amber-700 dark:text-amber-400',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  low: {
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    badge: 'bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
    title: 'text-blue-800 dark:text-blue-200',
    detail: 'text-blue-700 dark:text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
}

function SuggestionsPanel({ patterns, totalErrors }: { patterns: PatternStats; totalErrors: number }) {
  const suggestions = buildSuggestions(patterns, totalErrors)

  if (suggestions.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Suggestions based on your patterns</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          These are generated from your error distribution. Address high-urgency items first.
        </p>
      </div>

      <div className="space-y-3">
        {suggestions.map((s, i) => {
          const style = URGENCY_STYLE[s.urgency]
          return (
            <div key={i} className={`rounded-xl border px-4 py-3.5 flex items-start gap-3 ${style.border} ${style.bg}`}>
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                    {s.urgency === 'high' ? 'High priority' : s.urgency === 'medium' ? 'Recommended' : 'Note'}
                  </span>
                  <span className={`text-sm font-semibold ${style.title}`}>{s.title}</span>
                </div>
                <p className={`text-xs leading-relaxed ${style.detail}`}>{s.detail}</p>
              </div>
              <a
                href={s.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${style.btn}`}
              >
                {s.action}
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ErrorPatternViz() {
  const [patterns, setPatterns] = useState<PatternStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/error-book/stats/patterns', { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to load patterns (${res.status})`)
      setPatterns(await res.json() as PatternStats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading patterns…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  if (!patterns) return null

  const totalErrors =
    patterns.by_category.reduce((s, c) => s + c.count, 0) || patterns.by_topic.reduce((s, t) => s + t.count, 0)

  const topCategory = patterns.by_category[0]
  const topTopic = patterns.by_topic[0]
  const isEmpty = patterns.by_category.length === 0 && patterns.by_topic.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <svg className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
        <p className="text-base font-semibold text-gray-500 dark:text-gray-400">No pattern data yet</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Answer some questions and log errors to see patterns.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <StatsBar data={patterns.weekly} totalErrors={totalErrors} />

      {(topCategory || topTopic) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topCategory && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 dark:text-indigo-500 mb-1">Top error category</p>
                <p className="text-base font-bold text-indigo-800 dark:text-indigo-200">
                  {topCategory.category_label ?? topCategory.error_category ?? 'Unknown'}
                </p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {topCategory.count} error{topCategory.count !== 1 ? 's' : ''} — focus here first
                </p>
              </div>
              <Sparkline data={patterns.weekly} />
            </div>
          )}
          {topTopic && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-400 dark:text-rose-500 mb-1">Weakest topic</p>
              <p className="text-base font-bold text-rose-800 dark:text-rose-200">{topTopic.topic}</p>
              <p className="text-sm text-rose-600 dark:text-rose-400 mt-0.5">
                {topTopic.count} error{topTopic.count !== 1 ? 's' : ''} — needs the most attention
              </p>
            </div>
          )}
        </div>
      )}

      <SuggestionsPanel patterns={patterns} totalErrors={totalErrors} />

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Activity — last 28 days</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Each cell = one day. Darker = more errors logged.</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>None</span>
            {['#e0e7ff','#a5b4fc','#818cf8','#6366f1','#4338ca'].map(c => (
              <span key={c} className="h-4 w-4 rounded" style={{ backgroundColor: c }} />
            ))}
            <span>Many</span>
          </div>
        </div>
        <CalendarHeatmap data={patterns.weekly} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patterns.by_category.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Errors by category</h3>
            <DonutChart data={patterns.by_category} />
          </div>
        )}
        {patterns.by_topic.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Top topics with errors</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Showing up to 10 topics</p>
            <TopicBars data={patterns.by_topic} />
          </div>
        )}
      </div>

    </div>
  )
}
