// All copy lives here so sections stay presentational.
// Facts come from the resume; anything conceptual is labelled as such.

export const identity = {
  name: "Xiang Zhao",
  role: "Creative Man",
  edition: "Portfolio · 2026",
  location: "Germany/China",
  headline: "About Me",
  intro:
    "Medical Engineering master’s student building AI agents, autonomous driving tools, and embodied robotics products at the intersection of intelligence, mobility, and human interaction.",
  // TODO: replace the GitHub / LinkedIn placeholders with real profile URLs.
  links: {
    email: "mailto:shawn.zhao24@outlook.com",
    github: "https://github.com/",
    linkedin: "https://www.linkedin.com/",
  },
};

export const chapter = {
  eyebrow: "2026 · Milestone",
  title: "A New Chapter",
  subtitle: "From European road tests to a robot on my desk",
  body: "Five projects, one question: how does intelligence meet people? Every sticker on my face is one of them.",
  cta: "Get to know my experience",
};

export type Project = {
  id: string;
  /** name of the decal node in portfolio.glb this project is pinned to */
  decal: "decal-0" | "decal-1" | "decal-2" | "decal-3" | "decal-4";
  sticker: string;
  index: string;
  title: string;
  kicker: string;
  period: string;
  summary: string;
  points: string[];
  stack: string[];
  /** honesty label shown on the card when the work is conceptual / illustrative */
  note?: string;
  accent: string;
};

export const projects: Project[] = [
  {
    id: "homie",
    decal: "decal-2",
    sticker: "Ship it",
    index: "01",
    title: "Homie",
    kicker: "AI companion · Robotics",
    period: "2026.08 — now",
    summary:
      "A desktop AI companion for spoken American English, growing toward a physical robot body.",
    points: [
      "React / TypeScript interface wired to OpenAI, xAI / Grok and ElevenLabs for voice dialogue, persona and live subtitles.",
      "Local face detection and tracking in Python / OpenCV, mapped to on-screen eye direction; YOLO11n detection experiments.",
      "Perception → AI interaction → behaviour → control, designed as swappable modules.",
    ],
    stack: ["React", "TypeScript", "Python", "OpenCV", "YOLO11n"],
    note: "Head actuation and the quadruped form are in planning / prototype exploration — concept, not finished hardware.",
    accent: "#f08a3c",
  },
  {
    id: "driving",
    decal: "decal-3",
    sticker: "Taurus",
    index: "02",
    title: "Autonomous Driving",
    kicker: "ADAS validation · Momenta Germany",
    period: "2026.07 — now",
    summary:
      "Validating production ADAS / Navigation Pilot on real German and European roads.",
    points: [
      "Coverage across CP, ACC, LCC, iACC, automatic lane change, speed control and feature availability.",
      "Record, reproduce and classify abnormal scenarios from road tests, backed by vehicle-log analysis and regression checks.",
      "Speed-limit and traffic-sign recognition review: misses, false reads, late or wrong updates.",
    ],
    stack: ["Linux", "Vehicle logs", "SCP", "pandas"],
    note: "Visuals are illustrative only — no internal road-test data is shown.",
    accent: "#e2463a",
  },
  {
    id: "medical",
    decal: "decal-0",
    sticker: "Big idea",
    index: "03",
    title: "Medical AI",
    kicker: "FAU · Medical Engineering M.Sc.",
    period: "2025 — 2027",
    summary:
      "Image processing and data analysis as the base layer for clinical AI tools.",
    points: [
      "Master’s focus on image processing and data analysis at Friedrich-Alexander-Universität Erlangen-Nürnberg.",
      "PyTorch / CNN fundamentals applied to imaging pipelines.",
      "Exploring where agents can reduce friction in clinical workflows.",
    ],
    stack: ["Python", "NumPy", "PyTorch", "CNN"],
    note: "Concept / illustrative — no real patient cases are shown.",
    accent: "#f4c43a",
  },
  {
    id: "jev",
    decal: "decal-1",
    sticker: "ENFJ",
    index: "04",
    title: "JEV World",
    kicker: "Agent simulation",
    period: "2026",
    summary:
      "A living little town of 20 NPCs whose decisions come from a pluggable agent layer.",
    points: [
      "Grew out of a Three Kingdoms 190 sandbox into a roguelike strategy loop.",
      "Decision layer is swappable — the same world can run different agent brains.",
      "A GBA-style tile town where every resident actually walks the map.",
    ],
    stack: ["TypeScript", "LLM agents", "Simulation"],
    accent: "#7cc653",
  },
  {
    id: "weather",
    decal: "decal-4",
    sticker: "Sunny",
    index: "05",
    title: "Human Weather",
    kicker: "Emotion map",
    period: "2026",
    summary:
      "A world map of how people feel, aiming to become the source for a global happy-cities ranking.",
    points: [
      "Tap the map to drop your mood at an H3 resolution-9 cell.",
      "Voice Drop turns a short spoken note into a mood reading.",
      "Light-first world view with emotion particles over a MapLibre globe.",
    ],
    stack: ["MapLibre", "H3", "OpenAI", "TypeScript"],
    accent: "#f7b733",
  },
];
