# Aevyra – Musical Frame-to-Sound POC (Version 2)

A small, runnable React + TypeScript + Vite + Canvas 2D + Tone.js experiment. The image is the exact heatmap supplied by the user, stored at `public/reference-heatmap.jpg`.

## Run

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL (usually `http://localhost:5173`). Click **Play ambient soundscape** to authorize browser sound. Use headphones at a comfortable volume. `npm run build` builds for deployment.

## What it does

1. Canvas 2D downsamples the reference image to 240×112 pixels and samples 12 equally sized vertical regions.
2. Each region produces brightness, warm-pixel proportion, blue/cool proportion, and contrast values.
3. The melody uses a **C major pentatonic** scale. A deterministic note is selected from each region's brightness (55%), warm-pixel fraction (35%), and contrast (10%).
4. Chord progression C → Am → F → G and bass notes add musical structure. **These chords are an artistic scaffold, not scientific readings.**
5. Timbre/filter varies with the region's warm pixels and brightness; note durations and quiet accents change with adjacent-region differences.
6. Tone.js creates all sound in real time after the user clicks Play. It does **not** play prerecorded audio.
7. The scan cursor highlights the vertical strip that controls the current melody note.
8. Upload another image to see/hear a new mapping; no server or database is needed.

## Important limitations

- The provided reference heatmap **is not yet proven to be a NASA EIC resource**. Treat it as a visual reference, not evidence for a NASA challenge submission.
- Warm/cool pixel classifications are **visual features**, not temperature measurements. Verify NASA's legend and frame timing before making scientific claims.
- The POC explores one image spatially, **not historical changes over time**. Multiple timestamped frames are required to implement the Earth-history timeline.
- Perceptual audio quality depends on browser, device and speakers. Adjust musical settings after listening tests.
- Actual browser playback must be tested on the presentation laptop. Browsers require a user gesture for audio to start.

## Implementation files

- `src/analyzeFrame.ts`: pixel sampling and feature extraction.
- `src/mapping.ts`: musical rules; editable constants and scales.
- `src/App.tsx`: React UI and Tone.js instruments/scheduling.
- `src/style.css`: polished dark-space visual styling.

## Next hackathon steps

Verify a NASA EIC visualization and its resource/usage details. Prepare timestamped frames. Exclude titles/legends from the sampled map. Explain how map colors correspond to science. Test with blind/low-vision users where feasible and check keyboard/screen-reader operation. Add valid source attribution and share a public working demo.
