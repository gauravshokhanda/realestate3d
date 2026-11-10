# window-initial: trace-backed long tasks

PerformanceObserver task start aligned to d2-scroll-start trace marker on the renderer main thread. Native operation durations are unions of clipped trace spans, inclusive/nested and must not be summed across names. CPU sample times identify actually sampled functions, not inferred causes. Missing native/JS detail remains unattributed. Source maps used only when present in ATTRIBUTION_BUILD.

| Run | Device | Seconds into scroll | Scene | Duration ms | Trace operations | Sampled script/function |
| --- | --- | ---: | --- | ---: | --- | --- |
| 2 | mobile | 1.692 | hero-to-plan | 55.0 | FireAnimationFrame 39.4ms; v8.callFunction 38.5ms; FunctionCall 37.7ms; Layout 5.1ms | native/unattributed:0 ((program)); webpack://_N_E/./node_modules/.pnpm/motion-dom@12.43.0/node_modules/motion-dom/dist/es/animation/JSAnimation.mjs:14 (np) |
| 5 | mobile | 18.386 | plan-to-kitchen | 55.0 | Paint 28.9ms; v8.callFunction 9.5ms; FunctionCall 8.9ms; EventDispatch 8.0ms | native/unattributed:0 ((program)); webpack://_N_E/./node_modules/.pnpm/gsap@3.15.1/node_modules/gsap/ScrollTrigger.js:682 (eH) |
