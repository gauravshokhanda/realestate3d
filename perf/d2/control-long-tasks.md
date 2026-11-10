# control: trace-backed long tasks

PerformanceObserver task start aligned to d2-scroll-start trace marker on the renderer main thread. Native operation durations are unions of clipped trace spans, inclusive/nested and must not be summed across names. CPU sample times identify actually sampled functions, not inferred causes. Missing native/JS detail remains unattributed. Source maps used only when present in ATTRIBUTION_BUILD.

| Run | Device | Seconds into scroll | Scene | Duration ms | Trace operations | Sampled script/function |
| --- | --- | ---: | --- | ---: | --- | --- |
| 1 | desktop | 10.909 | plan-to-kitchen | 78.0 | Commit 72.1ms; v8.callFunction 3.5ms; FunctionCall 3.2ms; EventDispatch 3.2ms | native/unattributed:0 ((program)) |
| 4 | desktop | 4.505 | hero-to-plan | 51.0 | Commit 42.1ms; v8.callFunction 5.9ms; FunctionCall 5.6ms; FireAnimationFrame 3.8ms | native/unattributed:0 ((program)) |
| 5 | desktop | 3.738 | hero-to-plan | 53.0 | Commit 41.1ms; v8.callFunction 6.8ms; FunctionCall 5.9ms; FireAnimationFrame 5.0ms | native/unattributed:0 ((program)); http://localhost:4200/_next/static/chunks/8591-b88917790b2d29bf.js:1 (setScroll) |
| 5 | desktop | 5.203 | hero-to-plan | 72.0 | Commit 67.5ms; v8.callFunction 1.8ms; FunctionCall 1.6ms; EventDispatch 1.1ms | native/unattributed:0 ((program)) |
| 5 | desktop | 9.517 | plan-to-living | 69.0 | Commit 62.0ms; v8.callFunction 4.8ms; FunctionCall 4.3ms; EventDispatch 4.2ms | native/unattributed:0 ((program)); http://localhost:4200/_next/static/chunks/8591-b88917790b2d29bf.js:1 () |
| 5 | desktop | 11.982 | plan-to-kitchen | 54.0 | Commit 48.3ms; v8.callFunction 3.4ms; EventDispatch 3.0ms; FunctionCall 2.9ms | native/unattributed:0 ((program)) |
| 5 | desktop | 18.165 | plan-to-bedroom | 59.0 | Layerize 41.0ms; Commit 12.9ms; v8.callFunction 3.5ms; FunctionCall 3.1ms | native/unattributed:0 ((program)) |
