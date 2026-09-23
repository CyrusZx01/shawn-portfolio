# 个人作品站 · Intro3D 体验复刻 · 实施计划

日期：2026-09-23。目标目录：`/Users/shawn/Projects/shawn-portfolio`。

## Context / 为什么做

用户已在 intro3d.com 做出自己的 3D 作品页（导出模型 + 截图），现在要求**独立重建为自有代码库**，不 iframe 内嵌、不直接复用 GLB 了事。先做到与原体验的视觉/交互对等，再把 Homie、Medical AI、Autonomous Driving、Robotics、JEV World、HumanWeather 六个项目世界接进去。

明确要求：动手前先给结构化实施计划；目录按 `/components /scenes /animations /sections /ui /models /shaders` 拆分；保留 GLB 的模型、贴图、相机与 `CameraAction`；首页 = intro3d 首屏，向下滚动到 "New Chapter"，**该处改造为可交互入口**（类似 "Get to know my experience" 按钮 → 进入项目介绍）。

## 参考材料实况（必须先说清）

`/Users/shawn/Desktop/intro3d/` 实际只有 4 个文件，**不是代码库**：

| 文件 | 实况 |
|---|---|
| `Untitled-project.glb` (1.88 MB) | intro3d.com 的项目导出（scene 名 `intro3d-export`，THREE.GLTFExporter r184），贴图全部内嵌 |
| 3 张 `截屏…png` | intro3d **编辑器 Preview 模式**的区域截图（2201×1136 / 2199×1118 / 2204×1214） |

**不存在**：原站源码、录屏（无 .mov/.mp4/.webm）、独立贴图文件、项目素材、README。

因此"复刻"的基线只能是 **3 张静帧 + GLB 内真实相机数据**。滚动时序、缓动曲线、hover 反馈等无法从静帧还原，属于**有依据的近似重建**，不声称像素级一致。用户已确认按现有资料继续。

## 已提取的可执行事实

### A. GLB（可直接驱动实现）

- 节点：`model → model-normalized(scale 1.10846) → Scene → Mesh_0`，子节点 `decal-0..4`、`focus-0`、`focus-1`；另有 `Camera` 节点。
- 主体 mesh 0：13,015 顶点，POSITION/NORMAL/TEXCOORD_0，包围盒 ≈ `x[-0.851,0.855] y[-0.851,0.953] z[-0.374,0.370]`（高约 1.7 单位，是**半身像**）。
- 5 个贴纸 decal：84–345 顶点，位移 `[0.00196,0.05088,-0.00196]`，scale `0.90215`。
- `focus-0` / `focus-1` extras：`{dofEnabled:false, dofBokeh:4, dofFocusRange:0.5}` → 可直接当景深对焦目标。
- 相机：PerspectiveCamera，`yfov 0.8028515 rad`(=46°)，znear 0.1，zfar 100，`aspectRatio 1`（运行时由应用覆盖）。
- **唯一动画 `CameraAction`**：101 个 LINEAR 关键帧 @24fps，时长 4.1667 s，通道 = translation + rotation。
  - 轨迹 `(-0.564, 0.889, 3.525) → (0.816, 0.847, 2.011)`：推进 + 左→右摇。
  - ⚠️ 第 50 帧后数值不再变化（t≈2.083 s 起静止）→ 真实运动只有前 ~2.08 s，后一半是死区。
  - ⚠️ 只有 **1 条**相机动画，而截图至少有 2 个机位（hero + A New Chapter）→ 该 GLB 不是完整巡游记录，其余机位需自行设计。
- 贴图 8 张全部内嵌：3× WebP 2048²（baseColor / metallicRoughness / normal）+ 5× PNG 贴纸。
- `EXT_texture_webp` 同时在 `extensionsUsed` 与 **`extensionsRequired`** → 加载器必须支持 WebP，否则整个文件被拒。

### B. 视觉识别（从截图）

- 背景：接近中性的深灰（待脚本精确取样，非纯黑）。
- 字体：几何 grotesque；hero 标题极大（约占视口高 1/5），字重偏轻，字距收紧。
- 角标：小号大写字母 + 明显字距（`XIANG ZHAO` / `CREATIVE MAN` 左上，`PORTFOLIO · 2026` 右上，`GERMANY/CHINA` 右侧竖排）。
- 正文：小号低对比灰，约 3 行，窄栏。
- 联系入口：3 个细边框圆形图标按钮（邮件 / GitHub / LinkedIn）。
- `SCROLL DOWN` + 鼠标图标提示。
- 时间线卡片：圆点 + eyebrow（`2026 · Milestone`）→ 标题（`A New Chapter`）→ 副标题 → 正文，位于模型一侧。
- 3D 主体：风格化男性半身像，牛仔外套 + 白 T，深色卷发，面部贴纸；柔和棚光，胸下裁切，位于画面右/中。

### C. 交互模型（从截图 + 编辑器 chrome 反推）

`loading → hero → 滚动驱动相机沿路径 → 时间线 stop（每个 stop 有相机位 + 到达时浮出的 overlay 卡片）→ portfolio sections`

**"New Chapter" 不是页面，而是一个带 overlay 卡片的相机 stop。** 这正是用户要求改造的点：把该 stop 的卡片换成交互入口。

## 目标架构

```
shawn-portfolio/
├── public/models/portfolio.glb        # 用户自有导出（从 Desktop/intro3d 复制并改名）
├── docs/implementation-plan.md        # 本文件
└── src/
    ├── app/{layout,page}.tsx, globals.css
    ├── components/                    # 编排层：Experience、LoadingScreen、ScrollDriver、Overlay
    ├── scenes/                        # R3F 场景：PortfolioScene、Bust、CameraRig、Environment
    ├── animations/                    # cameraPath（由 CameraAction 派生）、easings、timeline stops
    ├── sections/                      # 各 stop 的内容定义（hero / newChapter / projects…）
    ├── ui/                            # 角标、圆形图标按钮、滚动提示、卡片
    ├── models/                        # GLB 加载、decal/focus 提取、归一化
    └── shaders/                       # 背景噪声/暗角/颗粒等
```

技术栈按用户指定：Next.js(App Router) + TypeScript + React Three Fiber + three + drei + GSAP + Framer Motion。

**实现原则**：这是对同类交互模式的**原创实现**（源码本身不可得），不是拷贝 intro3d 的专有代码；只使用用户自有的模型与文案。

## 分阶段实施

**阶段 1 — 对等基线（先做）**
1. 脚手架 + 设计 token（取样自截图的配色/字号/字距）。
2. `models/` 加载 GLB，提取 `Camera`、`CameraAction`、decal、focus 标记；归一化到场景坐标。
3. `scenes/PortfolioScene` + 灯光 + 环境；复现截图中的柔和棚光与胸下裁切构图。
4. `animations/cameraPath`：把 `CameraAction` 前 2.08 s 转为 hero 段，另设后续 stop 机位。
5. `LoadingScreen` + 首屏 overlay（姓名、标题、正文、联系按钮、SCROLL DOWN、竖排标签）。
6. `ScrollDriver`：滚动 → 归一化进度 → 相机插值 + overlay 淡入淡出。
7. 响应式：移动端重排文字与模型，不裁切主体。

**阶段 2 — New Chapter 改造（用户指定的重点）**
8. 该 stop 的卡片替换为交互入口：`Get to know my experience` 按钮 → 滚动/过渡到项目介绍段。
9. 预留 `sections/projects` 数据结构，接入六个项目世界。

**阶段 3 — 扩展**
10. 依次接入 Homie / Medical AI / Autonomous Driving / Robotics / JEV World / HumanWeather。
11. 在 3D 上做增强（用户要求"玩出花来"）：decal 作为可交互热点、focus 标记驱动的真实景深、模型对指针的微视差、stop 切换时的贴纸/光照叙事。

## 验证方式

- `npm run dev` 起本地服务；用 Playwright（本机已装 chromium）在**与截图相同的视口**（约 2200×1136）截图三个对应状态，与 3 张参考静帧并排比对：构图、字号层级、模型位置与裁切、卡片位置。
- 检查滚动时相机是否平滑、stop 是否按序触发、overlay 是否与相机同步。
- 检查移动端（390×844）无裁切、无重叠。
- 检查 WebP 贴图在目标浏览器正常解码。
- 记录逐项偏差，不达标则修到对等再进阶段 2。

## 边界与风险

- **只有 3 张静帧**：滚动时序、缓动、hover、转场是近似重建，不是精确还原。
- **GLB 相机动画只有 1 条且后半静止**：巡游路径需自行设计，不能假装是原站完整编排。
- **半身像**：模型是 bust，没有全身/骨骼，无法做行走或大幅度姿态；"玩出花"应聚焦相机、光照、贴纸、景深与材质，而非骨骼动画。
- **不是代码库**：不存在可参考的原站实现，所有代码为原创。
- 项目介绍中的 Medical AI / Driving 等内容必须保留"示意 / 概念"标注，不得暗示真实病例或公司内部路测数据。
