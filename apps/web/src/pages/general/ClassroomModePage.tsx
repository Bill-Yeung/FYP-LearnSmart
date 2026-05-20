import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"

type InteractiveElement = {
  id: string
  label: string
  desc: string
  route: string
  clipPath: string
  origin: string
  labelLeft: string
  labelTop: string
  svgPoints: string
}

const BG = "/images/game/classroom-bg.png"
const VW = 1920
const VH = 1072

export function ClassroomModePage() {
  const navigate = useNavigate()
  const [selectedElement, setSelectedElement] = useState<InteractiveElement | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const interactiveElements: InteractiveElement[] = [
    {
      id: "blackboard",
      label: "Knowledge Base",
      desc: "Upload and manage your study materials",
      route: "/knowledge",
      clipPath: "polygon(70.21% 60.91%, 23.85% 60.91%, 23.75% 29.85%, 70.21% 30.32%)",
      origin: "47.0% 45.5%",
      labelLeft: "47.0%",
      labelTop: "60.9%",
      svgPoints: "1348,653 458,653 456,320 1348,325",
    },
    {
      id: "teacher",
      label: "Ask the Teacher",
      desc: "Start AI Socratic dialogue to deepen understanding",
      route: "/comprehension/dialogue",
      clipPath: "polygon(36.46% 63.15%, 28.12% 62.97%, 28.70% 61.19%, 29.06% 55.41%, 29.74% 50.37%, 29.74% 45.99%, 30.83% 42.72%, 30.83% 37.03%, 30.52% 34.89%, 31.87% 31.44%, 33.39% 30.69%, 35.05% 31.81%, 36.09% 34.05%, 35.94% 39.74%, 36.20% 43.19%, 36.93% 44.40%, 37.97% 48.51%, 40.00% 40.39%, 40.00% 38.15%, 40.47% 38.25%, 41.35% 41.42%, 41.25% 43.00%, 39.95% 44.31%, 38.96% 52.99%, 38.18% 54.48%, 37.34% 53.17%, 37.24% 54.94%, 36.77% 55.69%, 38.07% 62.97%)",
      origin: "35.4% 46.1%",
      labelLeft: "35.4%",
      labelTop: "63.9%",
      svgPoints: "700,677 540,675 551,656 558,594 571,540 571,493 592,458 592,397 586,374 612,337 641,329 673,341 693,365 690,426 695,463 709,476 729,520 768,433 768,409 777,410 794,444 792,461 767,475 748,568 733,584 717,570 715,589 706,597 731,675",
    },
    {
      id: "bookshelf",
      label: "Review Flashcards",
      desc: "Practice with flashcards and spaced repetition",
      route: "/flashcards/review",
      clipPath: "polygon(71.61% 77.61%, 69.90% 77.61%, 70.00% 32.84%, 73.02% 30.41%, 82.14% 30.60%, 82.19% 47.95%, 79.69% 46.64%, 77.45% 46.64%, 74.95% 49.25%, 73.44% 53.08%, 73.96% 58.30%, 75.73% 60.82%, 76.56% 67.54%, 74.27% 70.15%, 71.61% 77.61%)",
      origin: "75.1% 55.1%",
      labelLeft: "75.1%",
      labelTop: "30%",
      svgPoints: "1375,832 1342,832 1344,352 1402,326 1577,328 1578,514 1530,500 1487,500 1439,528 1410,569 1420,625 1454,652 1470,724 1426,752 1375,832",
    },
    {
      id: "laptop",
      label: "Take Assessment",
      desc: "Practice teach-back exercises and test your knowledge",
      route: "/application/teach-back",
      clipPath: "polygon(17.08% 55.78%, 16.15% 55.69%, 15.16% 46.18%, 24.84% 46.08%, 25.73% 55.69%)",
      origin: "19.8% 51.9%",
      labelLeft: "19.8%",
      labelTop: "55.8%",
      svgPoints: "328,598 310,597 291,495 477,494 494,597",
    },
    {
      id: "students",
      label: "Study Together",
      desc: "Join study groups and collaborate with classmates",
      route: "/community/studygroups",
      clipPath: "polygon(75.26% 92.54%, 74.48% 92.44%, 74.79% 83.12%, 71.04% 88.25%, 68.07% 80.97%, 65.26% 81.06%, 67.86% 77.52%, 70.42% 80.60%, 74.32% 69.31%, 77.03% 66.98%, 73.23% 56.34%, 75.00% 49.72%, 77.81% 46.64%, 83.85% 48.41%, 84.69% 56.53%, 81.98% 65.86%, 86.61% 70.24%, 89.53% 65.67%, 87.08% 61.47%, 85.99% 52.52%, 89.74% 47.67%, 93.91% 49.44%, 95.42% 52.89%, 95.68% 57.00%, 94.53% 63.71%, 97.08% 67.07%, 99.01% 77.61%, 98.49% 91.88%)",
      origin: "82.4% 67.6%",
      labelLeft: "82.4%",
      labelTop: "46.6%",
      svgPoints: "1445,992 1430,991 1436,891 1364,946 1307,868 1253,869 1303,831 1352,864 1427,743 1479,718 1406,604 1440,533 1494,500 1610,519 1626,606 1574,706 1663,753 1719,704 1672,659 1651,563 1723,511 1803,530 1832,567 1837,611 1815,683 1864,719 1901,832 1891,985",
    },
    {
      id: "windows",
      label: "Exit Classroom",
      desc: "Return to the dashboard",
      route: "/dashboard",
      clipPath: "polygon(83.44% 0.00%, 83.65% 17.35%, 73.96% 24.81%, 74.17% 6.72%, 81.67% 0.00%)",
      origin: "79.4% 9.8%",
      labelLeft: "79.4%",
      labelTop: "24.8%",
      svgPoints: "1602,0 1606,186 1420,266 1424,72 1568,0",
    },
    {
      id: "calendar",
      label: "Plan Schedule",
      desc: "Plan your study schedule and workflow",
      route: "/plan-workflow",
      clipPath: "polygon(99.53% 50.37%, 94.22% 50.37%, 92.45% 48.51%, 90.83% 48.60%, 90.83% 25.93%, 99.17% 22.48%, 99.53% 50.37%)",
      origin: "95.2% 42.4%",
      labelLeft: "95.2%",
      labelTop: "50.4%",
      svgPoints: "1911,540 1809,540 1775,520 1744,521 1744,278 1904,241 1911,540",
    },
    {
      id: "notice",
      label: "Play Script-Kill",
      desc: "Solve mystery scenarios to learn through roleplay",
      route: "/game/play",
      clipPath: "polygon(55.31% 32.18%, 64.95% 32.18%, 64.95% 52.61%, 55.31% 52.61%)",
      origin: "60.1% 42.4%",
      labelLeft: "60.1%",
      labelTop: "52.6%",
      svgPoints: "1062,345 1247,345 1247,564 1062,564",
    },
    {
      id: "clock",
      label: "Check Progress",
      desc: "View your learning progress and analytics",
      route: "/progress",
      clipPath: "polygon(65.05% 24.44%, 62.81% 23.32%, 61.67% 21.36%, 61.35% 19.59%, 61.88% 15.39%, 64.01% 12.69%, 66.56% 13.62%, 67.40% 15.11%, 68.02% 17.91%, 67.60% 21.74%, 66.15% 23.88%, 65.05% 24.44%)",
      origin: "64.8% 19.5%",
      labelLeft: "64.8%",
      labelTop: "24.4%",
      svgPoints: "1249,262 1206,250 1184,229 1178,210 1188,165 1229,136 1278,146 1294,162 1306,192 1298,233 1270,256 1249,262",
    },
    {
      id: "drawer",
      label: "Browse Documents",
      desc: "Explore document analytics and key concepts",
      route: "/knowledge/documents",
      clipPath: "polygon(19.58% 92.16%, 14.69% 92.16%, 14.48% 83.02%, 20.00% 82.84%, 20.73% 80.78%, 20.52% 78.17%, 37.03% 78.36%, 38.75% 82.74%, 38.39% 84.51%, 36.67% 84.61%, 36.61% 91.98%, 19.58% 92.16%)",
      origin: "26.4% 85.3%",
      labelLeft: "26.4%",
      labelTop: "77%",
      svgPoints: "376,988 282,988 278,890 384,888 398,866 394,838 711,840 744,887 737,906 704,907 703,986 376,988",
    },
  ]

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-black">
      {/* Cover container */}
      <div
        className="absolute"
        style={{
          width: `max(100vw, ${(VW / VH) * 100}vh)`,
          height: `max(100vh, ${(VH / VW) * 100}vw)`,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <img
          src={BG}
          alt="Classroom"
          className="absolute inset-0 w-full h-full"
          draggable={false}
        />

        {/* Single clip-path zoom layer */}
        {hoveredId && (() => {
          const el = interactiveElements.find((e) => e.id === hoveredId)
          if (!el) return null
          return (
            <div
              className="absolute inset-0 w-full h-full pointer-events-none z-15"
              style={{
                clipPath: el.clipPath,
                transform: "scale(1.12)",
                transformOrigin: el.origin,
                filter: "brightness(1.3) saturate(1.15)",
                willChange: "transform, filter",
              }}
            >
              <img
                src={BG}
                alt=""
                className="absolute inset-0 w-full h-full"
                draggable={false}
              />
            </div>
          )
        })()}

        {/* SVG hit-test overlay */}
        <svg
          className="absolute inset-0 w-full h-full z-20"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
        >
          {interactiveElements.map((el) => (
            <polygon
              key={el.id}
              points={el.svgPoints}
              fill="transparent"
              cursor="pointer"
              onMouseEnter={() => setHoveredId(el.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelectedElement(el)}
            />
          ))}
        </svg>

        {/* Floating labels */}
        {interactiveElements.map((el) => (
          <div
            key={`label-${el.id}`}
            className="absolute z-30 pointer-events-none"
            style={{
              left: el.labelLeft,
              top: el.labelTop,
              transform: "translate(-50%, 4px)",
              transition: "opacity 0.25s ease",
              opacity: hoveredId === el.id ? 1 : 0,
            }}
          >
            <div className="bg-white/95 backdrop-blur-sm px-4 py-1.5 rounded-lg shadow-xl border-2 border-green-500 whitespace-nowrap">
              <span className="text-sm font-bold text-gray-900">{el.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Title + Exit */}
      <div className="absolute top-12 z-40 pointer-events-none" style={{ left: "35%", transform: "translateX(-50%)" }}>
        <h1 className="text-4xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Welcome to the Classroom!
        </h1>
        <p className="text-lg text-green-100 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] text-center">
          Click on any object to start learning
        </p>
      </div>
      <Button
        variant="ghost"
        className="absolute top-4 right-4 z-50 bg-white/90 hover:bg-white shadow-lg border-2 border-green-600"
        onClick={() => navigate("/dashboard")}
      >
        ← Exit Classroom
      </Button>

      {selectedElement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-green-600 animate-in zoom-in duration-200">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                {selectedElement.label}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {selectedElement.desc}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 text-lg py-3"
                onClick={() => setSelectedElement(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 text-lg py-3 bg-green-600 hover:bg-green-700"
                onClick={() => selectedElement && navigate(selectedElement.route)}
              >
                Let's Go!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
