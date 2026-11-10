# candidate: trace-backed long tasks

PerformanceObserver task start aligned to d2-scroll-start trace marker on the renderer main thread. Native operation durations are unions of clipped trace spans, inclusive/nested and must not be summed across names. CPU sample times identify actually sampled functions, not inferred causes. Missing native/JS detail remains unattributed. Source maps used only when present in ATTRIBUTION_BUILD.

| Run | Device | Seconds into scroll | Scene | Duration ms | Trace operations | Sampled script/function |
| --- | --- | ---: | --- | ---: | --- | --- |
| 2 | desktop | 3.018 | hero-to-plan | 95.0 | Layerize 89.6ms; v8.callFunction 3.5ms; FunctionCall 3.1ms; EventDispatch 3.0ms | native/unattributed:0 ((program)) |
| 2 | desktop | 3.901 | hero-to-plan | 53.0 | Commit 48.3ms; v8.callFunction 2.7ms; FunctionCall 2.5ms; FireAnimationFrame 1.9ms | native/unattributed:0 ((program)) |
| 2 | desktop | 4.064 | hero-to-plan | 66.0 | Commit 55.1ms; v8.callFunction 8.2ms; FunctionCall 7.9ms; FireAnimationFrame 7.0ms | native/unattributed:0 ((program)) |
| 3 | mobile | 4.283 | hero-to-plan | 63.0 | v8.callFunction 40.9ms; FunctionCall 36.8ms; FireAnimationFrame 33.9ms; EventDispatch 8.3ms | native/unattributed:0 ((program)); webpack://_N_E/./node_modules/.pnpm/motion-dom@12.43.0/node_modules/motion-dom/dist/es/animation/NativeAnimation.mjs:12 (t9) |
| 5 | mobile | 4.237 | hero-to-plan | 58.0 | FireAnimationFrame 47.1ms; v8.callFunction 47.1ms; FunctionCall 46.6ms; UpdateLayoutTree 8.1ms | native/unattributed:0 ((program)); native/unattributed:15 () |
| 5 | mobile | 4.770 | hero-to-plan | 61.0 | v8.callFunction 7.4ms; FunctionCall 6.7ms; EventDispatch 6.1ms; UpdateLayoutTree 3.1ms | native/unattributed:0 ((program)); webpack://_N_E/./node_modules/.pnpm/gsap@3.15.1/node_modules/gsap/Observer.js:120 () |
