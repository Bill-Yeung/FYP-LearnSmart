import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../../components/ui/Button"

type InteractiveClue = {
  id: string
  label: string
  desc: string
  route: string
  src: string
  left: string
  top: string
  width: string
  height: string
}

const BG = "/images/game/detective-bg.png"

export function DetectiveModePage() {
  const navigate = useNavigate()
  const [selectedClue, setSelectedClue] = useState<InteractiveClue | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const clues: InteractiveClue[] = [
    {
      id: "evidence-board",
      label: "Evidence Board",
      desc: "Review and analyze your documents and knowledge base",
      route: "/knowledge",
      src: "/images/game/detective-evidboard.png",
      left: "49.48%",
      top: "24.25%",
      width: "32.29%",
      height: "27.05%",
    },
    {
      id: "detective",
      label: "Interrogation",
      desc: "Ask AI questions with Socratic dialogue",
      route: "/comprehension/dialogue",
      src: "/images/game/detective-figure.png",
      left: "25%",
      top: "6.53%",
      width: "13.54%",
      height: "64.37%",
    },
    {
      id: "filing-cabinet",
      label: "Case Files",
      desc: "Practice with flashcards and spaced repetition",
      route: "/flashcards/review",
      src: "/images/game/detective-filingcab.png",
      left: "7.81%",
      top: "45.71%",
      width: "17.71%",
      height: "54.1%",
    },
    {
      id: "desk-lamp",
      label: "Desk Lamp",
      desc: "Take practice assessments and teach-back exercises",
      route: "/application/teach-back",
      src: "/images/game/detective-desklamp.png",
      left: "79.69%",
      top: "30.78%",
      width: "11.46%",
      height: "23.32%",
    },
    {
      id: "desk",
      label: "Detective's Desk",
      desc: "View your learning progress and analytics",
      route: "/progress",
      src: "/images/game/detective-desk.png",
      left: "14.58%",
      top: "64.37%",
      width: "79.69%",
      height: "35.45%",
    },
    {
      id: "window",
      label: "Window",
      desc: "Join study groups and collaborate with peers",
      route: "/community/studygroups",
      src: "/images/game/detective-window.png",
      left: "29.17%",
      top: "0.93%",
      width: "43.75%",
      height: "46.64%",
    },
    {
      id: "clock",
      label: "Wall Clock",
      desc: "Plan your study schedule and workflow",
      route: "/plan-workflow",
      src: "/images/game/detective-clock.png",
      left: "83.33%",
      top: "2.8%",
      width: "14.06%",
      height: "22.39%",
    },
    {
      id: "lamp",
      label: "Table Lamp",
      desc: "Play Script-Kill learning games",
      route: "/game/play",
      src: "/images/game/detective-lamp.png",
      left: "6.77%",
      top: "7.46%",
      width: "15.62%",
      height: "35.45%",
    },
    {
      id: "dark-corner",
      label: "Dark Corner",
      desc: "Browse document analytics and concepts",
      route: "/knowledge/documents",
      src: "/images/game/detective-darkcorner.png",
      left: "77.6%",
      top: "49.44%",
      width: "22.4%",
      height: "50.37%",
    },
  ]

  return (
    <div className="relative w-full h-screen overflow-hidden select-none">
      <img
        src={BG}
        alt="Detective's Office"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Dark overlay for noir atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none z-[5]" />

      {/* Cropped interactive object layers */}
      {clues.map((clue) => {
        const isHovered = hoveredId === clue.id
        return (
          <div
            key={clue.id}
            className="absolute cursor-pointer"
            style={{
              left: clue.left,
              top: clue.top,
              width: clue.width,
              height: clue.height,
              zIndex: isHovered ? 15 : 10,
            }}
            onMouseEnter={() => setHoveredId(clue.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => setSelectedClue(clue)}
          >
            <img
              src={clue.src}
              alt={clue.label}
              className="w-full h-full object-fill"
              draggable={false}
              style={{
                transition: "transform 0.35s ease, filter 0.35s ease",
                transform: isHovered ? "scale(1.08)" : "scale(1)",
                filter: isHovered ? "brightness(1.3) saturate(1.1)" : "brightness(1)",
              }}
            />
            {isHovered && (
              <div
                className="absolute inset-0 rounded-sm pointer-events-none"
                style={{ boxShadow: "inset 0 0 30px rgba(245, 158, 11, 0.4)" }}
              />
            )}
          </div>
        )
      })}

      {clues.map((clue) => (
        <div
          key={`label-${clue.id}`}
          className="absolute z-30 pointer-events-none"
          style={{
            left: `calc(${clue.left} + ${clue.width} / 2)`,
            top: `calc(${clue.top} + ${clue.height})`,
            transform: "translate(-50%, 4px)",
            transition: "opacity 0.25s ease",
            opacity: hoveredId === clue.id ? 1 : 0,
          }}
        >
          <div className="bg-amber-900/95 backdrop-blur-sm px-4 py-1.5 rounded-lg shadow-2xl border-2 border-amber-600 whitespace-nowrap">
            <span className="text-sm font-bold text-amber-100">{clue.label}</span>
          </div>
        </div>
      ))}

      <Button
        variant="ghost"
        className="absolute top-4 right-4 z-50 text-amber-200 hover:text-amber-100 bg-amber-900/60 hover:bg-amber-900/80 backdrop-blur-sm shadow-2xl border-2 border-amber-700"
        onClick={() => navigate("/dashboard")}
      >
        ← Close Case
      </Button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center z-40 pointer-events-none">
        <h1 className="text-4xl font-bold text-amber-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Detective's Office
        </h1>
        <p className="text-amber-400 text-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
          Investigate the clues to solve the mystery
        </p>
      </div>

      {selectedClue && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-amber-900 to-amber-950 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-4 border-amber-700 animate-in zoom-in duration-200">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-amber-100 mb-3">
                {selectedClue.label}
              </h2>
              <p className="text-lg text-amber-300">
                {selectedClue.desc}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-100 text-lg py-3"
                onClick={() => setSelectedClue(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-lg py-3"
                onClick={() => selectedClue && navigate(selectedClue.route)}
              >
                Investigate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
