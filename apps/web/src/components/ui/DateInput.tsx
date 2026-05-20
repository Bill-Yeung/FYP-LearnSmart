import { useState, useRef, useEffect } from "react"
import { format, parse, isValid, isBefore, startOfDay } from "date-fns"
import { Calendar } from "lucide-react"

type DateInputProps = {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  className?: string
  placeholder?: string
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function DateInput({ value, onChange, min, max, className = "", placeholder = "Select date" }: DateInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const d = parse(value, "yyyy-MM-dd", new Date())
      return isValid(d) ? d : new Date()
    }
    return new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : null
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : null
  const displayValue = selectedDate && isValid(selectedDate)
    ? format(selectedDate, "MMM d, yyyy")
    : ""

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startDay = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const days: (number | null)[] = []
  for (let i = 0; i < startDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const isDateDisabled = (day: number) => {
    const date = new Date(year, month, day)
    if (minDate && isBefore(date, startOfDay(minDate))) return true
    if (maxDate && isBefore(startOfDay(maxDate), date)) return true
    return false
  }

  const handleDayClick = (day: number) => {
    if (isDateDisabled(day)) return
    const newDate = new Date(year, month, day)
    onChange(format(newDate, "yyyy-MM-dd"))
    setIsOpen(false)
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center cursor-pointer ${className}`}
      >
        <input
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          className="w-full bg-transparent cursor-pointer outline-none"
        />
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-medium text-gray-900 dark:text-white">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} />
              }
              const isSelected = selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year
              const disabled = isDateDisabled(day)
              const isToday = new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(day)}
                  className={`
                    w-8 h-8 text-sm rounded-lg flex items-center justify-center transition-colors
                    ${isSelected
                      ? "bg-purple-600 text-white"
                      : isToday
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }
                    ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
