export type Question = {
  id: string
  topic: string
  stem: string
  choices: string[]
  answerIndex: number
  solution?: string
}

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    topic: "photosynthesis",
    stem: "Which of the following is the primary site of photosynthesis in plant cells?",
    choices: ["Mitochondrion", "Chloroplast", "Ribosome", "Golgi apparatus"],
    answerIndex: 1,
    solution: "Chloroplasts contain chlorophyll and are the site of the light-dependent and light-independent reactions."
  },
  {
    id: "q2",
    topic: "photosynthesis",
    stem: "During the light reactions, which molecule is produced?",
    choices: ["Glucose", "ATP", "Amino acids", "Fatty acids"],
    answerIndex: 1,
    solution: "Light reactions generate ATP and NADPH used in the Calvin cycle."
  },
  {
    id: "q3",
    topic: "kinematics",
    stem: "An object moves with constant velocity. Which of the following is true?",
    choices: ["Acceleration is non-zero", "Speed changes", "Acceleration is zero", "Net force is changing"],
    answerIndex: 2,
    solution: "Constant velocity implies zero acceleration (no net force)."
  }
]

export type Concept = {
  id: string
  title: string
  definition: string
  keywords: string[]
}

export const CONCEPTS: Concept[] = [
  {
    id: "c_photosynthesis",
    title: "Photosynthesis",
    definition: "Process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water.",
    keywords: ["chlorophyll", "chloroplast", "light reactions", "Calvin cycle"]
  },
  {
    id: "c_kinematics",
    title: "Kinematics",
    definition: "Branch of mechanics that describes the motion of points, bodies and systems of bodies without considering the forces that caused the motion.",
    keywords: ["velocity", "acceleration", "displacement"]
  }
]

export const SAMPLE_EXPLANATIONS = [
  {
    conceptId: "c_photosynthesis",
    explanation: "Photosynthesis happens in plants. The leaves make food using sunlight. I think chlorophyll does something with light.",
    by: "student1"
  },
  {
    conceptId: "c_kinematics",
    explanation: "If something moves at the same speed it has constant velocity so there is no acceleration.",
    by: "student2"
  }
]

export const SIMPLIFIED_EXAMPLES = {
  "c_photosynthesis": "Photosynthesis is how plants use sunlight to turn water and CO2 into sugar. It happens in chloroplasts.",
  "c_kinematics": "Kinematics studies how things move, like speed and direction, without talking about forces."
}

export const REFLECTION_PROMPTS = [
  "How would you teach this concept to a peer?",
  "Which part of your explanation was hardest to convey?",
  "What example would you use in class?"
]

export const CHECK_UNDERSTANDING_EXAMPLES = [
  {
    conceptId: "c_photosynthesis",
    flagged: [
      { text: "I think chlorophyll does something with light.", reason: "Vague: missing mechanism (electron transfer)" }
    ]
  }
]
