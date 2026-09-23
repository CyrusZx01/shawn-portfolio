# shawn-portfolio

Original Next.js + R3F rebuild of my Intro3D portfolio experience. Handoff notes: `docs/CONTEXT.md`, plan: `docs/implementation-plan.md`.

```
npm run dev        # http://localhost:3000
npm run build
node scripts/shoot.mjs 2200 1136 shots/x 0 1.0 id:project-homie+1.2   # visual check (server on :3217, or URL=...)
# /lab?w=homie&p=0.5&play=1   one project world in isolation, with a progress slider
```

## How it works (round 2)

- Smooth scroll: custom gsap ticker scroller (`src/animations/smoothScroll.ts`), no extra deps.
- Bust gaze: `src/shaders/bustLook.ts` turns the head in the vertex shader (neck-weighted) and repaints the eyes procedurally so irises follow the cursor; blinks. No rig needed.
- Projects: pinned track, 300svh per project. Approach (fly to sticker) → dive (accent circle opens from the sticker) → a real 3D world per project (`src/worlds/<id>/`), with a scroll-driven story (step rail) and drag-to-orbit.
- Worlds: Homie (desk stance ↔ 4-leg walking form, procedural IK gait), Driving (ACC/LCC/lane change/sign recognition), Medical (point-cloud volume, slice, segment, measure), JEV (living voxel town, day→night), Human Weather (dot globe, mood particles, H3 hexes, click to drop a mood).
- World labels use `src/worlds/Label.tsx` (not drei `<Html>`: StrictMode-safe and respects visibility).
- Honesty flags are in the copy: Homie 4-leg = concept, Driving visuals illustrative, Medical concept, Weather demo data.

## Visual TODOs (known mismatches vs reference, not yet tuned)

- [ ] Hero bust ~10% smaller and sits slightly higher than reference shot 1 (bottom crop ends ~88% vs ~96% of height).
- [ ] End of CameraAction is closer / more turned than reference shot 3; that shot likely sits mid-path. Consider capping the path at ~0.6–0.7 or adding a dedicated stop.
- [ ] Hero lede wraps to 4 lines (reference: 3) — Inter vs the reference font; widen measure or pick a closer face.
- [ ] Chapter card enters later / lower than reference shot 2 (card at ~80% height when scrolled 1/3 viewport).
- [ ] Mobile (390×844): bust overlaps hero copy; film grain is visibly strong on small DPR; close-up framing untested.
- [ ] Background/vignette/halo: centre ≈ #1d1d1d, corners slightly lighter than intended; skin reads a touch warmer/brighter than reference.
- [ ] Project close-ups crop the top of the head; framing per sticker not individually tuned.
- [ ] GitHub / LinkedIn URLs are placeholders (`src/sections/content.ts`).
- [ ] `THREE.Clock` deprecation warning (from R3F internals) — harmless.
- [ ] LoadingScreen keeps a rAF loop running after load — minor cleanup.
- [ ] Homie walk: one frame at p≈0.7 once showed the crouched body without legs (not reproduced).
- [ ] Weather H3 step: globe glow overlaps the card at 16:9; could shrink the dive framing.
