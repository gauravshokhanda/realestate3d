# system-pressure: trace-backed long tasks

PerformanceObserver task start aligned to d2-scroll-start trace marker on the renderer main thread. Native operation durations are unions of clipped trace spans, inclusive/nested and must not be summed across names. CPU sample times identify actually sampled functions, not inferred causes. Missing native/JS detail remains unattributed. Source maps used only when present in ATTRIBUTION_BUILD.

| Run | Device | Seconds into scroll | Scene | Duration ms | Trace operations | Sampled script/function |
| --- | --- | ---: | --- | ---: | --- | --- |
| 1 | desktop | 3.080 | hero-to-plan | 78.0 | Commit 68.8ms; v8.callFunction 4.8ms; FunctionCall 4.6ms; FireAnimationFrame 4.1ms | native/unattributed:0 ((program)) |
| 1 | mobile | 16.829 | plan-to-kitchen | 76.0 | PrePaint 73.6ms; UpdateLayoutTree 1.1ms; Commit 0.2ms; v8.callFunction 0.2ms | native/unattributed:0 ((program)) |
| 1 | mobile | 22.329 | plan-to-bedroom | 55.0 | FireAnimationFrame 1.6ms; v8.callFunction 1.3ms; FunctionCall 1.1ms; Layerize 0.5ms | native/unattributed:0 ((program)) |
| 2 | desktop | 0.738 | hero-to-plan | 87.0 | Commit 72.2ms; v8.callFunction 7.9ms; FunctionCall 7.2ms; FireAnimationFrame 5.3ms | native/unattributed:0 ((program)) |
| 2 | desktop | 1.577 | hero-to-plan | 82.0 | Layout 74.4ms; v8.callFunction 2.3ms; FunctionCall 2.0ms; UpdateLayoutTree 1.9ms | native/unattributed:0 ((program)) |
| 2 | desktop | 3.037 | hero-to-plan | 113.0 | Commit 109.1ms; v8.callFunction 1.7ms; FunctionCall 1.5ms; FireAnimationFrame 1.0ms | native/unattributed:0 ((program)) |
| 2 | desktop | 5.103 | hero-to-plan | 76.0 | Commit 65.9ms; HitTest 4.3ms; v8.callFunction 2.7ms; FunctionCall 2.4ms | native/unattributed:0 ((program)) |
| 2 | desktop | 9.733 | plan-to-living | 104.0 | Commit 98.5ms; v8.callFunction 2.0ms; FunctionCall 1.7ms; EventDispatch 1.4ms | native/unattributed:0 ((program)) |
| 2 | desktop | 15.201 | plan-to-kitchen | 74.0 | Commit 69.3ms; v8.callFunction 1.7ms; FunctionCall 1.5ms; Layerize 1.3ms | native/unattributed:0 ((program)) |
| 2 | desktop | 15.647 | plan-to-kitchen | 79.0 | Commit 74.7ms; v8.callFunction 2.0ms; FunctionCall 1.8ms; EventDispatch 1.3ms | native/unattributed:0 ((program)); http://localhost:4100/_next/static/chunks/d5df7396-9a2208d0019e6e5d.js:1 (r) |
| 2 | desktop | 17.354 | plan-to-bedroom | 55.0 | v8.callFunction 50.8ms; FunctionCall 50.3ms; FireAnimationFrame 49.1ms; UpdateLayoutTree 5.5ms | native/unattributed:0 ((program)) |
| 2 | desktop | 20.715 | plan-to-bedroom | 69.0 | v8.callFunction 54.6ms; FunctionCall 54.1ms; FireAnimationFrame 53.3ms; Commit 9.0ms | native/unattributed:0 ((program)) |
| 2 | mobile | 2.639 | hero-to-plan | 72.0 | ScrollLayer 60.4ms; v8.callFunction 1.0ms; EventDispatch 0.9ms; FunctionCall 0.8ms | native/unattributed:0 ((program)); native/unattributed:0 ((idle)) |
| 2 | mobile | 7.755 | hero-to-plan | 236.0 | FireAnimationFrame 234.8ms; v8.callFunction 234.6ms; FunctionCall 234.6ms; UpdateLayoutTree 0.2ms | http://localhost:4100/_next/static/chunks/d5df7396-9a2208d0019e6e5d.js:1 (r); native/unattributed:0 ((program)) |
| 2 | mobile | 8.468 | plan-to-living | 59.0 | FireAnimationFrame 57.6ms; v8.callFunction 56.3ms; FunctionCall 55.7ms; UpdateLayoutTree 0.2ms | native/unattributed:0 (requestAnimationFrame); native/unattributed:0 ((program)) |
| 2 | mobile | 13.757 | plan-to-kitchen | 332.0 | FireAnimationFrame 0.3ms; v8.callFunction 0.2ms; Commit 0.2ms; UpdateLayoutTree 0.2ms | native/unattributed:0 ((program)) |
| 2 | mobile | 18.205 | plan-to-kitchen | 64.0 | TimerFire 63.6ms; v8.callFunction 63.6ms; FunctionCall 63.6ms | http://localhost:4100/_next/static/chunks/8591-4a7f5a3621a6fcff.js:1 (ew); native/unattributed:0 ((program)) |
| 3 | desktop | 1.552 | hero-to-plan | 61.0 | Commit 55.8ms; v8.callFunction 2.3ms; FunctionCall 2.1ms; EventDispatch 1.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 2.392 | hero-to-plan | 51.0 | Commit 38.2ms; v8.callFunction 7.0ms; FunctionCall 6.2ms; EventDispatch 4.4ms | native/unattributed:0 ((program)) |
| 3 | desktop | 2.678 | hero-to-plan | 59.0 | SimpleWatcher::OnHandleReady 59.0ms; v8.callFunction 59.0ms; FunctionCall 58.6ms; v8.newInstance 0.0ms | http://localhost:4100/_next/static/chunks/fd99ade1-b93accd6f14e05dd.js:1 (ui); native/unattributed:0 ((program)) |
| 3 | desktop | 3.509 | hero-to-plan | 77.0 | v8.callFunction 48.9ms; FunctionCall 44.5ms; FireAnimationFrame 42.1ms; Layerize 24.0ms | native/unattributed:0 ((program)) |
| 3 | desktop | 3.627 | hero-to-plan | 64.0 | UpdateLayoutTree 26.3ms; v8.callFunction 25.8ms; FunctionCall 25.3ms; EventDispatch 14.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 3.755 | hero-to-plan | 55.0 | v8.callFunction 46.8ms; FunctionCall 46.3ms; FireAnimationFrame 44.0ms; UpdateLayoutTree 39.4ms | native/unattributed:0 ((program)) |
| 3 | desktop | 3.862 | hero-to-plan | 51.0 | v8.callFunction 34.7ms; FunctionCall 34.2ms; FireAnimationFrame 29.5ms; UpdateLayoutTree 11.3ms | native/unattributed:0 ((program)) |
| 3 | desktop | 3.924 | hero-to-plan | 59.0 | v8.callFunction 29.5ms; FunctionCall 28.0ms; EventDispatch 23.5ms; FireAnimationFrame 18.0ms | native/unattributed:0 ((program)) |
| 3 | desktop | 4.030 | hero-to-plan | 95.0 | v8.callFunction 42.5ms; FunctionCall 42.0ms; EventDispatch 31.9ms; FireAnimationFrame 29.8ms | native/unattributed:0 ((program)) |
| 3 | desktop | 4.126 | hero-to-plan | 66.0 | v8.callFunction 51.3ms; EventDispatch 46.8ms; FunctionCall 22.5ms; UpdateLayoutTree 18.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 4.257 | hero-to-plan | 70.0 | v8.callFunction 59.0ms; FireAnimationFrame 54.9ms; FunctionCall 54.4ms; Layout 16.3ms | native/unattributed:0 ((program)) |
| 3 | desktop | 4.438 | hero-to-plan | 51.0 | v8.callFunction 40.0ms; FunctionCall 39.6ms; FireAnimationFrame 33.7ms; UpdateLayoutTree 30.7ms | native/unattributed:0 ((program)) |
| 3 | desktop | 4.806 | hero-to-plan | 98.0 | Commit 61.3ms; v8.callFunction 27.1ms; FunctionCall 26.2ms; FireAnimationFrame 22.4ms | native/unattributed:0 ((program)) |
| 3 | desktop | 4.905 | hero-to-plan | 99.0 | Commit 46.6ms; v8.callFunction 12.8ms; FunctionCall 12.1ms; EventDispatch 7.0ms | native/unattributed:0 ((program)) |
| 3 | desktop | 5.038 | hero-to-plan | 55.0 | v8.callFunction 33.3ms; FunctionCall 31.8ms; FireAnimationFrame 29.7ms; UpdateLayoutTree 28.9ms | native/unattributed:0 ((program)) |
| 3 | desktop | 5.199 | hero-to-plan | 91.0 | Commit 82.3ms; v8.callFunction 5.1ms; FunctionCall 4.2ms; EventDispatch 4.1ms | native/unattributed:0 ((program)) |
| 3 | desktop | 5.588 | hero-to-plan | 122.0 | Commit 98.8ms; Layerize 15.2ms; v8.callFunction 4.0ms; FunctionCall 3.7ms | native/unattributed:0 ((program)) |
| 3 | desktop | 5.870 | hero-to-plan | 56.0 | Commit 44.8ms; v8.callFunction 6.0ms; FunctionCall 5.3ms; FireAnimationFrame 4.1ms | native/unattributed:0 ((program)) |
| 3 | desktop | 6.045 | hero-to-plan | 58.0 | Commit 46.4ms; v8.callFunction 9.8ms; FunctionCall 9.4ms; EventDispatch 8.4ms | native/unattributed:0 ((program)) |
| 3 | desktop | 6.116 | plan-to-living | 78.0 | Commit 39.1ms; v8.callFunction 33.3ms; FunctionCall 31.2ms; FireAnimationFrame 26.6ms | native/unattributed:0 ((program)) |
| 3 | desktop | 7.385 | plan-to-living | 469.0 | Commit 458.9ms; v8.callFunction 6.3ms; EventDispatch 4.5ms; FunctionCall 4.1ms | native/unattributed:0 ((program)) |
| 3 | desktop | 11.687 | plan-to-kitchen | 72.0 | v8.callFunction 68.7ms; FireAnimationFrame 67.8ms; FunctionCall 1.8ms; EventDispatch 1.1ms | native/unattributed:0 ((program)) |
| 3 | desktop | 12.215 | plan-to-kitchen | 82.0 | v8.callFunction 71.7ms; FunctionCall 71.4ms; EventDispatch 60.9ms; FireAnimationFrame 11.2ms | native/unattributed:0 ((program)) |
| 3 | desktop | 12.493 | plan-to-kitchen | 61.0 | v8.callFunction 27.9ms; FireAnimationFrame 15.3ms; FunctionCall 14.8ms; EventDispatch 13.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 13.878 | plan-to-kitchen | 182.0 | v8.callFunction 180.1ms; FunctionCall 179.9ms; FireAnimationFrame 179.8ms; UpdateLayoutTree 178.5ms | http://localhost:4100/_next/static/chunks/8591-4a7f5a3621a6fcff.js:1 (setScroll); native/unattributed:0 ((program)) |
| 3 | desktop | 14.429 | plan-to-kitchen | 67.0 | v8.callFunction 59.1ms; FunctionCall 58.6ms; FireAnimationFrame 54.4ms; UpdateLayoutTree 54.2ms | native/unattributed:0 ((program)) |
| 3 | desktop | 16.475 | plan-to-bedroom | 81.0 | Commit 72.7ms; v8.callFunction 4.7ms; FunctionCall 4.2ms; FireAnimationFrame 3.0ms | native/unattributed:0 ((program)) |
| 3 | desktop | 16.655 | plan-to-bedroom | 76.0 | Commit 66.4ms; v8.callFunction 6.1ms; FunctionCall 5.7ms; FireAnimationFrame 4.3ms | native/unattributed:0 ((program)) |
| 3 | desktop | 16.881 | plan-to-bedroom | 51.0 | Commit 37.3ms; EventDispatch 6.0ms; PrePaint 4.4ms; v8.callFunction 2.9ms | native/unattributed:0 ((program)) |
| 3 | desktop | 17.098 | plan-to-bedroom | 224.0 | Commit 207.6ms; v8.callFunction 9.4ms; EventDispatch 9.0ms; FunctionCall 6.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 17.932 | plan-to-bedroom | 63.0 | Commit 21.5ms; v8.callFunction 20.9ms; FunctionCall 19.6ms; EventDispatch 17.6ms | native/unattributed:0 ((program)) |
| 3 | desktop | 20.193 | plan-to-bedroom | 95.0 | Paint 89.9ms; v8.callFunction 1.9ms; FunctionCall 1.5ms; FireAnimationFrame 1.0ms | native/unattributed:0 ((program)) |
| 3 | desktop | 20.833 | plan-to-bedroom | 55.0 | Commit 50.7ms; v8.callFunction 2.2ms; FunctionCall 1.9ms; FireAnimationFrame 1.3ms | native/unattributed:0 ((program)) |
| 3 | desktop | 21.308 | plan-to-bedroom | 57.0 | Commit 43.3ms; UpdateLayoutTree 5.3ms; v8.callFunction 3.9ms; FunctionCall 3.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 21.858 | amenities | 194.0 | Commit 179.6ms; v8.callFunction 5.6ms; FunctionCall 5.1ms; FireAnimationFrame 3.5ms | native/unattributed:0 ((program)) |
| 3 | desktop | 22.495 | amenities | 284.0 | Commit 276.9ms; v8.callFunction 1.8ms; FunctionCall 1.6ms; Paint 1.2ms | native/unattributed:0 ((program)) |
| 3 | desktop | 22.858 | amenities | 200.0 | Commit 190.1ms; v8.callFunction 7.6ms; FunctionCall 6.9ms; FireAnimationFrame 5.3ms | native/unattributed:0 ((program)) |
| 3 | desktop | 23.125 | contact | 67.0 | FireAnimationFrame 57.0ms; v8.callFunction 55.9ms; FunctionCall 54.2ms; EventDispatch 4.9ms | native/unattributed:0 ((program)) |
| 3 | mobile | 4.996 | hero-to-plan | 65.0 | v8.callFunction 33.5ms; FunctionCall 31.5ms; FireAnimationFrame 29.2ms; EventDispatch 18.2ms | native/unattributed:0 ((program)) |
| 3 | mobile | 5.242 | hero-to-plan | 683.0 | FireAnimationFrame 680.8ms; v8.callFunction 120.4ms; FunctionCall 120.3ms; Commit 1.1ms | native/unattributed:0 ((program)); http://localhost:4100/_next/static/chunks/d5df7396-9a2208d0019e6e5d.js:1 (r) |
| 3 | mobile | 8.838 | plan-to-living | 84.0 | Commit 82.9ms; IntersectionObserverController::computeIntersections 82.5ms; FireAnimationFrame 0.3ms; v8.callFunction 0.2ms | native/unattributed:0 ((program)) |
| 3 | mobile | 28.479 | amenities | 60.0 | Paint 54.5ms; FireAnimationFrame 1.5ms; v8.callFunction 1.4ms; UpdateLayoutTree 1.3ms | native/unattributed:0 ((program)) |
| 3 | mobile | 29.353 | amenities | 55.0 | FireAnimationFrame 50.6ms; v8.callFunction 50.6ms; FunctionCall 50.5ms; PrePaint 2.4ms | native/unattributed:0 ((program)) |
| 3 | mobile | 29.721 | amenities | 61.0 | Layout 43.7ms; FireAnimationFrame 2.1ms; v8.callFunction 1.7ms; Layerize 0.7ms | native/unattributed:0 ((program)) |
| 4 | desktop | 0.638 | hero-to-plan | 74.0 | Commit 69.3ms; v8.callFunction 3.1ms; FunctionCall 2.6ms; FireAnimationFrame 2.0ms | native/unattributed:0 ((program)) |
| 4 | desktop | 4.451 | hero-to-plan | 66.0 | Commit 57.2ms; v8.callFunction 4.7ms; FunctionCall 4.4ms; FireAnimationFrame 3.8ms | native/unattributed:0 ((program)) |
| 4 | desktop | 7.416 | plan-to-living | 155.0 | Commit 149.7ms; v8.callFunction 3.1ms; EventDispatch 2.7ms; FunctionCall 2.7ms | native/unattributed:0 ((program)) |
| 4 | desktop | 7.601 | plan-to-living | 55.0 | Commit 44.0ms; v8.callFunction 8.5ms; FunctionCall 8.1ms; EventDispatch 6.9ms | native/unattributed:0 ((program)) |
| 4 | desktop | 7.715 | plan-to-living | 155.0 | Commit 146.7ms; v8.callFunction 4.5ms; FunctionCall 4.1ms; FireAnimationFrame 2.9ms | native/unattributed:0 ((program)) |
| 4 | desktop | 9.301 | plan-to-living | 158.0 | Commit 144.7ms; v8.callFunction 7.9ms; EventDispatch 6.7ms; FunctionCall 6.2ms | native/unattributed:0 ((program)); http://localhost:4100/_next/static/chunks/8591-4a7f5a3621a6fcff.js:1 (setScroll) |
| 4 | desktop | 17.697 | plan-to-bedroom | 103.0 | Commit 99.6ms; v8.callFunction 2.0ms; FunctionCall 1.8ms; FireAnimationFrame 1.4ms | native/unattributed:0 ((program)); http://localhost:4100/_next/static/chunks/app/%5Bslug%5D/page-dcfa043afab21ae9.js:1 (send) |
| 4 | desktop | 21.076 | plan-to-bedroom | 70.0 | v8.callFunction 37.1ms; FunctionCall 36.2ms; FireAnimationFrame 28.4ms; Commit 12.2ms | native/unattributed:0 ((program)) |
| 4 | desktop | 21.992 | amenities | 55.0 | Layout 20.5ms; Layerize 17.8ms; Commit 6.4ms; v8.callFunction 6.2ms | native/unattributed:0 ((program)) |
| 4 | desktop | 22.276 | amenities | 63.0 | v8.callFunction 51.8ms; FunctionCall 45.4ms; EventDispatch 34.8ms; FireAnimationFrame 17.5ms | native/unattributed:0 ((program)) |
| 4 | mobile | 1.738 | hero-to-plan | 121.0 | FireAnimationFrame 0.5ms; v8.callFunction 0.4ms; FunctionCall 0.4ms; PrePaint 0.0ms | native/unattributed:0 ((program)) |
| 4 | mobile | 5.955 | hero-to-plan | 496.0 | v8.callFunction 480.4ms; FunctionCall 480.1ms; EventDispatch 470.2ms; FireAnimationFrame 10.1ms | http://localhost:4100/_next/static/chunks/8591-4a7f5a3621a6fcff.js:1 (); native/unattributed:0 ((program)) |
| 4 | mobile | 7.191 | hero-to-plan | 84.0 | v8.callFunction 83.2ms; EventDispatch 83.2ms; FunctionCall 83.1ms; UpdateLayoutTree 0.2ms | native/unattributed:0 ((program)) |
| 4 | mobile | 18.812 | plan-to-kitchen | 209.0 | Layerize 1.2ms; Paint 0.8ms; Commit 0.8ms; PrePaint 0.6ms | native/unattributed:0 ((program)) |
