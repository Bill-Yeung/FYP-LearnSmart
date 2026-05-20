export const spacedItems: any[] = []

export const engineItems: any[] = []

export const interleaveTracks: any[] = []

export const mnemonicKits: any[] = []

export const sensoryOptions: any[] = []

export const arVrActions = [
  {
    title: "AR memory palace",
    desc: "Place cards or 3D anchors in physical rooms for spatial recall.",
    cta: "Enter AR scene",
    note: "Calls visual pro to open Swift-based AR experience."
  },
  {
    title: "VR mystery run",
    desc: "Sherlock-style scene where wrong answers impact NPCs to deepen stakes.",
    cta: "Launch VR scene",
    note: "Calls visual pro to open Swift-based VR experience."
  }
]

export const defaultDueCounts = {
  today: 42,
  overdue: 8,
  new: 12
}

export const sampleTopics = ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "History"]

function buildSampleDeck(topic: string) {
  return Array.from({ length: 20 }, (_, i) => {
    const idx = i + 1
    const isMc = idx % 5 === 0
    return {
      id: `${topic.toLowerCase()}-${idx}`,
      front: isMc ? `Which option matches ${topic} concept ${idx}?` : `${topic} concept ${idx}: explain briefly.`,
      back: `${topic} key idea ${idx}: concise explanation for testing UI flows.`,
      dueLabel: idx % 3 === 0 ? "Overdue" : "Due now",
      choices: isMc
        ? [
            `${topic} distractor A ${idx}`,
            `${topic} correct ${idx}`,
            `${topic} distractor B ${idx}`,
            `${topic} distractor C ${idx}`
          ]
        : undefined
    }
  })
}

export const reviewCards = buildSampleDeck(sampleTopics[0])

export const manageSeedCards = [
  { id: "m1", front: "Define osmosis", back: "Movement of water across a semipermeable membrane from low to high solute concentration." },
  { id: "m2", front: "Derivative of sin x", back: "cos x" },
  { id: "m3", front: "Binary search best case", back: "O(1) when the mid is the target." },
  { id: "m4", front: "What is a covalent bond?", back: "A chemical bond formed by sharing electron pairs." },
  { id: "m5", front: "HTTP status 404", back: "Resource not found." }
]
