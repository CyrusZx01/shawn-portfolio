import { useLang, type Lang } from "@/i18n/lang";

// All copy lives here so sections stay presentational. English is the source;
// `zh` below overrides it field by field, read through useContent().
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

/** Short UI strings that aren't part of a project. */
export const uiText = {
  scrollDown: "Scroll down",
  chipsLabel: "Jump to a project",
  tip: "Tip — tap a sticker on my face",
  diveIn: "Scroll to dive in",
  next: "Next",
  sayHello: "Say hello",
  storyHint: "Scroll to play · drag to look around",
  outroEyebrow: "Next chapter",
  outroTitle: "Let’s build it.",
  outroBody: "Open to roles in autonomous driving / ADAS validation and robotics / embodied AI.",
  backToTop: "Back to top",
  loading: "Loading",
  projectsNav: "Projects",
  stack: "Stack",
  language: "Language",
  more: "Details",
  less: "Less",
};

type Step = { label: string; caption: string };

const zh = {
  identity: {
    name: "赵翔",
    role: "Creative Man",
    edition: "作品集 · 2026",
    location: "德国 / 中国",
    headline: "关于我",
    intro: "医学工程硕士在读，在智能、出行与人机交互的交汇处，打造 AI 智能体、自动驾驶工具和具身机器人产品。",
  },
  chapter: {
    eyebrow: "2026 · 里程碑",
    title: "新篇章",
    subtitle: "从欧洲道路测试，到我桌上的机器人",
    body: "五个项目，一个问题：智能如何与人相遇？我脸上的每一张贴纸，都是其中一个。",
    cta: "了解我的经历",
  },
  ui: {
    scrollDown: "向下滚动",
    chipsLabel: "跳转到项目",
    tip: "提示：点一点我脸上的贴纸",
    diveIn: "继续滚动，进入项目",
    next: "下一个",
    sayHello: "打个招呼",
    storyHint: "滚动播放 · 拖动环视",
    outroEyebrow: "下一章",
    outroTitle: "一起做点东西吧。",
    outroBody: "正在寻找自动驾驶 / ADAS 验证，以及机器人 / 具身智能方向的机会。",
    backToTop: "回到顶部",
    loading: "加载中",
    projectsNav: "项目",
    stack: "技术栈",
    language: "语言",
    more: "详情",
    less: "收起",
  } satisfies typeof uiText,
  projects: {
    homie: {
      kicker: "AI 陪伴 · 机器人",
      period: "2026.08 — 至今",
      summary: "一个陪你练美式口语的桌面 AI 伙伴，正在长出实体机器人的身体。",
      points: [
        "React / TypeScript 界面接入 OpenAI、xAI / Grok 与 ElevenLabs，实现语音对话、人设与实时字幕。",
        "用 Python / OpenCV 做本地人脸检测与跟踪，映射为屏幕上的眼神方向；并做了 YOLO11n 检测实验。",
        "感知 → AI 交互 → 行为 → 控制，按可替换模块设计。",
      ],
      note: "头部驱动与四足形态仍在规划 / 原型探索阶段——是概念，不是成品硬件。",
    },
    driving: {
      title: "自动驾驶",
      kicker: "ADAS 验证 · Momenta 德国",
      period: "2026.07 — 至今",
      summary: "在德国及欧洲真实道路上验证量产 ADAS / 导航辅助驾驶（NOA）。",
      points: [
        "覆盖 CP、ACC、LCC、iACC、自动变道、速度控制与功能可用性。",
        "记录、复现并归类路测中的异常场景，辅以整车日志分析与回归检查。",
        "限速与交通标志识别复核：漏识别、误识别、更新过晚或错误。",
      ],
      stack: ["Linux", "整车日志", "SCP", "pandas"],
      note: "画面仅为示意——不展示任何内部路测数据。",
    },
    medical: {
      title: "医学 AI",
      kicker: "FAU · 医学工程硕士",
      summary: "以图像处理与数据分析，作为临床 AI 工具的底层能力。",
      points: [
        "在埃尔朗根-纽伦堡大学（FAU）攻读硕士，方向为图像处理与数据分析。",
        "将 PyTorch / CNN 基础应用到医学影像流程中。",
        "探索智能体能在哪些环节减少临床工作流的摩擦。",
      ],
      note: "概念 / 示意——不展示任何真实病例。",
    },
    jev: {
      kicker: "智能体模拟",
      summary: "一座住着 20 个 NPC 的小镇，每个决定都来自可插拔的智能体层。",
      points: [
        "从三国 190 沙盘演化而来，变成一套肉鸽策略循环。",
        "决策层可替换——同一个世界可以跑不同的智能体大脑。",
        "GBA 风格的瓷砖小镇，每个居民都真的在地图上行走。",
      ],
      stack: ["TypeScript", "LLM 智能体", "模拟"],
    },
    weather: {
      title: "Human Weather",
      kicker: "情绪地图",
      summary: "一张记录人们感受的世界地图，目标是成为全球幸福城市排名的出处。",
      points: [
        "点一下地图，把心情投放到 H3 第 9 级网格里。",
        "Voice Drop 把一段简短语音转成一次心情读数。",
        "亮色优先的世界视图，情绪粒子浮在 MapLibre 地球之上。",
      ],
    },
  } as Record<string, Partial<Pick<Project, "title" | "kicker" | "period" | "summary" | "points" | "stack" | "note">>>,
  steps: {
    homie: [
      { label: "Homie", caption: "桌面伙伴。一块会回嘴的 3.5 英寸屏幕，人脸跟踪让它的眼睛看向你。" },
      { label: "Spider Homie", caption: "另一具独立的身体：同样的声音、同样的脸、四条腿。是概念款，不是变形。" },
      { label: "四足行走", caption: "预览步态：对角腿成对迈步，落脚即固定，两关节 IK。概念，非量产硬件。" },
      { label: "Run it back", caption: "腿分两种，嘴只有一种。" },
    ],
    driving: [
      { label: "ACC", caption: "自适应巡航与前车保持时距。示意场景，无内部数据。" },
      { label: "LCC", caption: "车道居中保持让车辆走在车道中心线上。" },
      { label: "自动变道", caption: "自动变道：规划轨迹、检查间隙、并入。" },
      { label: "标志识别", caption: "复核限速识别中的漏识别、误识别与更新延迟。" },
    ],
    medical: [
      { label: "重建", caption: "体数据从零散采样中逐渐成形。合成数据，仅为概念。" },
      { label: "扫描", caption: "一张轴向切片扫过整个体积。" },
      { label: "分割", caption: "模型高亮一个区域，并描出它的轮廓。" },
      { label: "测量", caption: "形状与大小变成临床医生可以核对的数字。" },
    ],
    jev: [
      { label: "小岛", caption: "一座 GBA 风格的瓷砖小镇，一块一块拼起来。" },
      { label: "居民", caption: "二十个 NPC 沿着各自的路线在地图上走动。" },
      { label: "决策", caption: "可插拔的智能体层决定每一步行动。" },
      { label: "入夜", caption: "白天变成黑夜——小镇依旧在生活。" },
    ],
    weather: [
      { label: "陆地网格", caption: "5,967 个陆地网格凝聚成一个地球。" },
      { label: "情绪天气", caption: "情绪像天气一样从城市上空升起。" },
      { label: "H3 网格", caption: "每一份心情都落进一个第 9 级六边形。" },
      { label: "投下你的", caption: "点击地球投下一份心情——演示数据。" },
    ],
  } as Record<string, Step[]>,
};

function localize(lang: Lang) {
  if (lang === "en") return { identity, chapter, projects, ui: uiText, steps: {} as Record<string, Step[]> };
  return {
    identity: { ...identity, ...zh.identity },
    chapter: zh.chapter,
    projects: projects.map((p) => ({ ...p, ...zh.projects[p.id] })),
    ui: zh.ui,
    steps: zh.steps,
  };
}

const cache = { en: localize("en"), zh: localize("zh") };
export type Content = (typeof cache)["en"];

/** Copy for the current language (re-renders on switch). */
export function useContent(): Content {
  return cache[useLang()];
}
