# shawn-portfolio

Original Next.js + R3F rebuild of my Intro3D portfolio experience. Handoff notes: `docs/CONTEXT.md`, plan: `docs/implementation-plan.md`.

```
npm run dev        # http://localhost:3000
npm run build
node scripts/shoot.mjs 2200 1136 shots/x 0 1.0 id:project-homie   # visual check (server on :3217, or URL=...)
```

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
