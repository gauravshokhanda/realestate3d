# Real-video Chrome verification

Installed Google Chrome, production build. Lint, build, five importer tests, and all four smoke modes passed. Form delivery is mocked. No live email or Lighthouse verification was performed.

| Mode | Console errors | Runtime errors | HTTP errors | Cancelled requests | Initial MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| desktop | 0 | 0 | 0 | 1 | 16.38 |
| mobile | 0 | 0 | 0 | 0 | 7.31 |
| desktop-reduced | 0 | 0 | 0 | 0 | not measured |
| mobile-reduced | 0 | 0 | 0 | 0 | not measured |

Real hero frames exceed the original 3 MB initial-transfer budget at the requested quality. All desktop scenes exceed the 8 MB warning threshold.

Frame review and interpolation limitations: [frames/README.md](frames/README.md).

- [Kitchen final frame](frames/plan-to-kitchen-last.png)
- [Bedroom repaired corner](frames/plan-to-bedroom-last-corner.png)
- [Desktop full page](desktop-reduced-full-page.png)
- [Mobile hero](mobile-000.png)
- [Smoke report](smoke-report.json)

- [Chrome recording (MP4)](recordings/chrome-scroll.mp4)
- [Recording checks](recordings/report.json)
- [Frame review zip](frames-review.zip)
