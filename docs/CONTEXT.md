# 交接文档 · shawn-portfolio（Intro3D 体验复刻）

最后更新：2026-09-23。用途：切换模型/会话时接续，不用重新调研。

---

## 1. 用户要什么（原始诉求）

用户已在 **intro3d.com** 做出自己的 3D 作品页，现在要求：

> "I want to independently recreate the ENTIRE website experience as my own codebase. The Intro3D page should be treated as the visual and interaction reference."
> "Do not embed Intro3D using iframe. Do not redesign everything immediately. First recreate the existing Intro3D experience as accurately as possible. Analyze the reference material and create a structured implementation plan before writing code."

**复刻清单（用户列的 18 项）**：整体视觉识别、页面布局、排版、导航、3D 场景、相机运动、滚动交互、hover、点击交互、标签与 UI overlay、项目分区、转场、loading screen、移动端响应式、光照、后期处理、背景效果、动画时序与缓动。

**架构要求**（用户指定目录）：`/components /scenes /animations /sections /ui /models /shaders`

**技术栈要求**：Next.js + TypeScript + React + React Three Fiber + Three.js + Drei + GSAP + Framer Motion

**两条中文补充要求（关键）**：
1. 进入网站 = intro3d 文件夹里的首页；向下滚动到 **"New Chapter"** 处，**把它改造成交互界面** —— 点击类似 `Get to know my experience` 的按钮 → 进入项目介绍。
2. "整体网站要结合这个 intro3d 文件夹里的内容来，不能突兀" + **"我希望你可以在这个 3d 建模上玩出花来"**。

**GLB 要求**："The existing GLB contains the original 3D model, textures, camera and CameraAction animation. Preserve them where useful."

**后续（阶段 3）**：达成视觉对等后，接入六个项目世界 —— Homie（含 Robotics 双形态）、Medical AI、Autonomous Driving、JEV World（20 NPC）、HumanWeather。

---

## 2. ⚠️ 参考材料实况（最重要的发现）

`/Users/shawn/Desktop/intro3d/` **不是代码库**，只有 4 个文件：

| 文件 | 实况 |
|---|---|
| `Untitled-project.glb` (1,881,032 B) | intro3d.com 项目导出，`THREE.GLTFExporter r184`，scene 名 `intro3d-export`，贴图全部内嵌。`xattr` 显示来源 `https://intro3d.com/` |
| `截屏2026-09-23 13.27.38.png` (2201×1136) | hero 状态 |
| `截屏2026-09-23 13.28.08.png` (2199×1118) | 滚动中，"A New Chapter" 卡片可见 |
| `截屏2026-09-23 13.28.21.png` (2204×1214) | 更近机位，模型占满画面 |

**不存在**：原站源码、录屏（无 .mov/.mp4/.webm）、独立贴图、项目素材、README。

→ 用户提到的 "screen recording showing all interactions" 和 "images and project assets" **实际没有**。
→ 用户已知情，选择「按现有资料继续」。**滚动时序、缓动曲线、hover 反馈无法从静帧还原，属有依据的近似重建，不得声称像素级一致。**

**intro3d 是活的 SaaS 产品**（Next.js + Cloudflare，`intro3d.com`）。公开 `https://intro3d.com/skill.md` 记录了它的 scene schema 与 REST API。**本次是实现同类交互模式的原创代码**，源码不可得，不要声称在拷贝 intro3d 的专有实现。

---

## 3. GLB 硬数据（已解析，勿重复调研）

来源脚本：`/tmp/analyze-intro3d.mjs`（可重跑：`node /tmp/analyze-intro3d.mjs`）

**节点图（12 节点）**
```
0  model                → 1
1  model-normalized     translation (-0.00217, -0.056399, 0.00217)  scale 1.1084600  → 2
2  Scene                → 3
3  Mesh_0 (mesh 0)      → children 4..10
4-8  decal-0..4         (meshes 1-5)  translation (0.001957, 0.050880, -0.001957)  scale 0.9021525
9  focus-0              translation (-0.723593, 0.031193, -0.328612)  scale 0.9021525
                        extras {dofEnabled:false, dofBokeh:4, dofFocusRange:0.5}
10 focus-1              translation (-0.525951, -0.497013, -1.302851)  scale 0.9021525
                        extras {dofEnabled:false, dofBokeh:4, dofFocusRange:0.5}
11 Camera               translation (-0.564162, 0.888795, 3.525478)
```

**相机**：perspective，`aspectRatio 1`（占位，运行时由应用覆盖），`yfov 0.8028514559173916 rad` = **46.0°**，znear 0.1，zfar 100。

**唯一动画 `CameraAction`**：101 个 LINEAR 关键帧 @24fps，时长 **4.1667 s**，通道 = `translation` + `rotation`（node 11）。
- translation：`t0 (-0.5642, 0.8888, 3.5255)` → `t2.0 (0.7608, 0.8486, 2.0714)` → `t2.5 (0.816, 0.8469, 2.0108)`
- rotation (quat xyzw)：`t0 (-0.1145, 0.0306, 0.0035, 0.9929)` → `t2.0 (-0.1782, 0.1786, 0.0329, 0.9671)` → `t2.5 (-0.1815, 0.1883, 0.0354, 0.9645)`
- ⚠️ **`frozenFrom = key 50, t = 2.0833`** —— 第 50 帧后数值完全不变，真实运动只有前 ~2.08 s，后一半是死区。**播放时需截断，否则有 2 秒静止。**
- ⚠️ **只有 1 条相机动画**，而截图至少有 2 个机位（hero + A New Chapter）→ 该 GLB **不是完整巡游记录**，其余 stop 机位必须自行设计，不能假装是原站编排。

**几何**：mesh 0 主体 **13,015 顶点**，POSITION/NORMAL/TEXCOORD_0，包围盒 ≈ `x[-0.851, 0.855] y[-0.851, 0.953] z[-0.374, 0.370]` → **高约 1.7 单位的半身像（bust）**，无骨骼、无全身。meshes 1-5 = 5 个贴纸，84–345 顶点。

**材质**：`Material_0`（身体）metallic 1 / roughness 1（靠贴图驱动）；decal 1-5 metallic 0 / roughness 1，`alphaMode: BLEND`。

**贴图 8 张全部内嵌**：images 0-2 = `image/webp` 2048²（baseColor / metallicRoughness / normal）；images 3-7 = `image/png`（贴纸）。
⚠️ `EXT_texture_webp` 同时在 `extensionsUsed` 与 **`extensionsRequired`** → 加载器必须支持 WebP 解码，否则整个文件被拒。

---

## 4. 截图视觉数据

**背景色（已精确取样）：`#1d1d1d`** —— 三张图所有采样点一致（唯一例外是 13.28.21 下方 `#756d6c`，那是模型本体像素）。

**布局（hero，13.27.38）**
- 左上角：`XIANG ZHAO` / 下一行 `CREATIVE MAN` —— 小号大写、明显字距、低对比
- 右上角：`PORTFOLIO · 2026` —— 同样小号大写
- 右侧竖排：`GERMANY/CHINA`（writing-mode vertical，贴右边缘）
- 左侧主标题：`About Me` —— 极大（约占视口高 1/5），几何 grotesque，字重偏轻，字距收紧
- 标题下正文（约 3 行、窄栏、低对比灰）：`Medical Engineering master's student building AI agents, autonomous driving tools, and embodied robotics products at the intersection of intelligence, mobility, and human interaction.`
- 3 个细边框**圆形**图标按钮：邮件 / GitHub / LinkedIn
- `SCROLL DOWN` + 小鼠标图标
- 3D 主体：风格化男性半身像，牛仔外套 + 白 T，深色卷发，面部贴纸；柔和棚光；**胸下裁切**；位于画面**右/中**

**时间线卡片（13.28.08 / 13.28.21）**
- 圆点 + eyebrow：`2026 · Milestone`（小号灰）
- 标题：`A New Chapter`（粗体、白）
- 副标题：`Add a short subtitle`
- 正文：`Share what this moment is about.`
- （后两行是 intro3d 的**占位文案**，正式站要替换）
- 位置：模型一侧（先在右下，后到中右）

⚠️ **右上角白色 "Exit preview" 胶囊是 intro3d 编辑器 chrome，不属于发布页 —— 不要复刻。**

**交互模型（从截图 + 编辑器 chrome 反推）**
```
loading → hero → 滚动驱动相机沿路径 → 时间线 stop（相机位 + 到达时浮出的 overlay 卡片）→ portfolio sections
```
**"New Chapter" 不是页面/路由，而是一个带 overlay 卡片的相机 stop。** 用户要改造的正是这个 stop。

---

## 5. 已产出的文档

| 路径 | 内容 |
|---|---|
| `/Users/shawn/Projects/shawn-portfolio-implementation-plan.md` | **主实施计划**（用户要求的那份），含参考实况、硬数据、目标架构、分阶段实施、验证方式、边界风险 |
| `/Users/shawn/Documents/Codex/2026-09-23/ba/outputs/shawn-world/docs/3d-world-brief.md` | 六幕项目世界的内容与事实边界 brief |
| `/Users/shawn/Documents/Codex/2026-09-23/ba/outputs/shawn-world/docs/reference-production-plan.md` | 六幕参考图生成计划（状态 `not verified`） |
| `/Users/shawn/Projects/shawn-identity-site/docs/content-style-brief.md` | **已作废**（早期静态单页方案，被 3D 方案取代） |
| `/tmp/analyze-intro3d.mjs` | GLB + 截图解析脚本，可重跑 |

---

## 6. 环境

- **Node v26.5.0 / npm 11.17.0**
- Playwright **1.63.0** 可用（`npx playwright`），chromium 已装于 `~/Library/Caches/ms-playwright/chromium-1243`
- 项目 `node_modules` 里**没有** playwright，需用全局 npx
- Chrome / Safari 已装
- 无 python PIL、无 imagemagick；`sips` / `swift` / `qlmanage` 可用

---

## 7. 相关既有项目（可复用素材，勿重复造）

| 路径 | 用途 |
|---|---|
| `/Users/shawn/Documents/Codex/2026-09-23/ba/outputs/shawn-world/` | **既有 Vite + React + three 站**，6 个展台（weather/homie/npc/driving/medical/journey）+ 通用导览化身。**不是本次目标**（用户要 Next.js + R3F 新代码库），但其 `src/World.jsx` 的相机跟随/射线点击/清理逻辑可参考；`public/models/homie-desktop.glb`、`homie-spider.glb` 是阶段 3 的素材 |
| `/Users/shawn/Projects/human-weather/` | Human Weather 原项目（MapLibre 地球 + 情绪粒子） |
| `/Users/shawn/Documents/Codex/2026-09-22/files-pasted-by-the-user-0/outputs/three-kingdoms-190/` | 三国 190 / JEV 原项目（含 `/town` 20 NPC） |
| `/Users/shawn/Documents/Codex/2026-09-08/con/outputs/homie-app/` | Homie 语音原型 |
| `/Users/shawn/Desktop/HOMIE_双形态海报.png` | Homie 双形态视觉锚点（奶油白 + 橙 + 黑关节） |
| `/Users/shawn/Documents/Codex/2026-09-21/b/work/resume_text.txt` | **简历事实来源**（姓名赵翔、FAU 医学工程、Momenta Germany ADAS 实习等） |
| `/Users/shawn/Documents/Codex/2026-09-21/wo-da/outputs/简历使用与面试准备.md` | **诚实性边界**：哪些能写、哪些不能声称 |

---

## 8. 尚未开始的下一步

1. **脚手架**：在 `/Users/shawn/Projects/shawn-portfolio` 起 Next.js(App Router) + TS + R3F + drei + GSAP + framer-motion（计划假设**新建项目**，未与用户最终确认）
2. 复制 GLB → `public/models/portfolio.glb`
3. 设计 token：底色 `#1d1d1d`、字号/字距层级、圆形按钮、竖排标签
4. `models/` 加载 GLB，提取 Camera / CameraAction / decal / focus
5. `scenes/` 场景 + 棚光 + 胸下裁切构图
6. `animations/cameraPath`：CameraAction 前 2.08 s → hero 段，另设后续 stop
7. LoadingScreen + 首屏 overlay
8. ScrollDriver：滚动 → 进度 → 相机插值 + overlay 淡入淡出
9. **New Chapter stop 改造为交互入口**（`Get to know my experience` → 项目介绍）
10. 阶段 3：接入六个项目世界

---

## 9. 未决问题

- **新建项目 vs 扩展现有 `shawn-world`**：计划按新建推进（用户明确要 Next.js + 独立代码库），但未逐字确认
- **字体**：截图是几何 grotesque，未确认具体字体；需选一个 Web 字体逼近
- **滚动时序**：只有 3 张静帧，stop 数量、间距、缓动均需自行设计
- **是否保留 intro3d 编辑器的可编辑结构**（hero/timeline/portfolio 的 schema 化）：未讨论

---

## 10. 硬边界（不要违反）

- 只有 3 张静帧 → 时序/缓动/hover 是**近似重建**，不得声称像素级还原
- GLB 只有 1 条相机动画且后半静止 → 巡游路径需自行设计，**不得声称是原站完整编排**
- 模型是**半身像、无骨骼** → "玩出花"应聚焦**相机、光照、贴纸 decal、景深（focus 标记）、材质**，不能做骨骼动画/行走
- 不是代码库 → 所有代码为**原创实现**，不要声称在拷贝 intro3d 源码
- 不要复刻 "Exit preview" 编辑器 chrome
- 阶段 3 的 Medical AI / Autonomous Driving 内容必须保留**「示意 / 概念」**标注，不得暗示真实病例或公司内部路测数据；Homie 四足形态标注**概念**，不得暗示实体硬件已完成

---

## 11. 实施状态（2026-09-23 第一轮，已停止视觉调参）

代码库：`/Users/shawn/Projects/shawn-portfolio`（git 已初始化）。`npm run dev` / `npm run build` 均通过；视觉自检用 `node scripts/shoot.mjs <w> <h> <out> <scroll...>`（先起服务在 3217 端口）。

**已完成**：hero 复刻（角标/横线/竖排/About Me/圆按钮/SCROLL DOWN）；GLB `CameraAction` 前 2.08 s 由滚动驱动；New Chapter 改造成入口卡片（CTA + 5 个项目 chip）；5 个 decal 贴纸 = 5 个项目热点（hover 发光 + tooltip，点击飞到特写）；项目段特写机位 + 强调色 rim light/光晕 + DOF；outro；loading screen；移动端基础重排。

贴纸 ↔ 项目：decal-2 SHIP IT→Homie，decal-3 TAURUS→自动驾驶，decal-0 BIG IDEA→Medical AI，decal-1 ENFJ→JEV World，decal-4 太阳→Human Weather。

**已知坑**：postprocessing 的 `ToneMapping(NEUTRAL)` 会把 #1d1d1d 压成近黑 → 已移除，勿加回。

**TODO（视觉偏差，未调）**：见 README 同名清单。
