# Higgsfield cinematic asset

Drop the generated loop here with **exactly** this name:

```
public/video/moon-cinematic.mp4
```

Optional poster frame (shown while loading):

```
public/video/moon-cinematic.jpg
```

## Asset requirements

| Property      | Requirement                                                   |
| ------------- | ------------------------------------------------------------- |
| Format        | H.264 MP4 (add a WebM sibling if you want smaller files)       |
| Resolution    | 1920 × 1080 (or 1080 × 1350 for a portrait variant)            |
| Duration      | 6–12 seconds                                                   |
| File size     | Under ~6 MB for mobile-friendly delivery                       |
| Loop          | Seamless — the first and last frames must match                |
| Motion        | Continuous slow orbit; no cuts, no camera shake, no speed ramps |
| Palette       | Midnight navy / black, blue-silver lunar surface, lavender rim |
| Frame rate    | 24–30 fps                                                      |

## How it is wired

`src/components/HiggsfieldLayer.jsx` does a `HEAD` request to
`/video/moon-cinematic.mp4` on load. If the file exists and is served as
a video, a **“Play the film”** button appears in the hero; until then the
button stays hidden entirely — no dead controls.

The video is **never** a substitute for the interactive Three.js moon or
the first-person lunar world. It is an optional cinematic *layer* that
opens over the page, loops silently, muted by default.
