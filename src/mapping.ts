
import type {
  FrameFeatures,
  Region,
} from "./analyzeFrame";

export type MusicalStep = {
  note: string;
  chord: string[];
  bass: string;
  durationMs: number;
  filterHz: number;
  accent: boolean;
  intensity: number;
};

export type MusicalMapping = {
  steps: MusicalStep[];
  musicalKey: string;
};

const clamp = (value: number): number =>
  Math.max(0, Math.min(1, value));

const MELODY = [
  "C4", "D4", "E4", "G4", "A4",
  "C5", "D5", "E5", "G5",
];

type Harmony = {
  chord: string[];
  bass: string;
};

/*
 * Different harmonic families for different
 * characteristics of the image.
 *
 * These are artistic interpretations,
 * not temperature measurements.
 */

const COOL_HARMONIES: Harmony[] = [
  {
    chord: ["A2", "C3", "E3", "G3"],
    bass: "A1",
  },
  {
    chord: ["D3", "F3", "A3", "C4"],
    bass: "D2",
  },
  {
    chord: ["E3", "G3", "B3", "D4"],
    bass: "E2",
  },
];

const BALANCED_HARMONIES: Harmony[] = [
  {
    chord: ["C3", "E3", "G3", "B3"],
    bass: "C2",
  },
  {
    chord: ["F3", "A3", "C4", "E4"],
    bass: "F2",
  },
  {
    chord: ["G2", "C3", "D3", "G3"],
    bass: "G2",
  },
];

const WARM_HARMONIES: Harmony[] = [
  {
    chord: ["E3", "G3", "B3", "D4"],
    bass: "E2",
  },
  {
    chord: ["G3", "B3", "D4", "F4"],
    bass: "G2",
  },
  {
    chord: ["A3", "C4", "E4", "G4"],
    bass: "A2",
  },
];

/*
 * Create one harmonic mood for each group
 * of three image regions.
 *
 * Unlike the old version, chord selection
 * depends on actual image features.
 */

function chooseHarmony(
  regions: Region[],
  startIndex: number
): Harmony {
  const group = regions.slice(
    startIndex,
    startIndex + 3
  );

  const average = (key: keyof Region) =>
    group.reduce(
      (sum, region) => sum + region[key],
      0
    ) / Math.max(1, group.length);

  const warmth = average("warmth");
  const coolness = average("coolness");
  const brightness = average("brightness");
  const contrast = average("contrast");

  let harmonies: Harmony[];

  if (coolness > warmth + 0.08) {
    harmonies = COOL_HARMONIES;
  } else if (warmth > coolness + 0.08) {
    harmonies = WARM_HARMONIES;
  } else {
    harmonies = BALANCED_HARMONIES;
  }

  /*
   * Choose a chord within that family
   * using measured image properties.
   */
  const score = clamp(
    brightness * 0.50 +
    contrast * 0.30 +
    warmth * 0.20
  );

  const index = Math.min(
    harmonies.length - 1,
    Math.floor(score * harmonies.length)
  );

  return harmonies[index];
}

/*
 * Convert a region into a melodic note.
 */

function chooseMelody(
  region: Region,
  previous: Region | null,
  index: number
): string {
  let score = clamp(
    region.brightness * 0.45 +
    region.warmth * 0.35 +
    region.contrast * 0.20
  );

  let noteIndex = Math.floor(
    score * MELODY.length
  );

  if (region.warmth > 0.45) {
    noteIndex += 2;
  }

  if (region.coolness > 0.40) {
    noteIndex -= 2;
  }

  if (previous) {
    const colorChange =
      Math.abs(
        region.warmth - previous.warmth
      ) +
      Math.abs(
        region.coolness - previous.coolness
      );

    if (colorChange > 0.30) {
      noteIndex +=
        index % 2 === 0 ? 2 : -2;
    }
  }

  noteIndex = Math.max(
    0,
    Math.min(
      MELODY.length - 1,
      noteIndex
    )
  );

  return MELODY[noteIndex];
}

/*
 * Calculate differences between regions.
 */

function regionDifference(
  current: Region,
  previous: Region | null
): number {
  if (!previous) return 0;

  return clamp(
    Math.abs(
      current.brightness -
      previous.brightness
    ) * 0.30 +

    Math.abs(
      current.warmth -
      previous.warmth
    ) * 0.35 +

    Math.abs(
      current.coolness -
      previous.coolness
    ) * 0.25 +

    Math.abs(
      current.contrast -
      previous.contrast
    ) * 0.10
  );
}

/*
 * Stable regions sound slower.
 * Rapidly changing regions sound faster.
 */

function chooseDuration(
  difference: number,
  contrast: number
): number {
  const activity = clamp(
    difference * 1.6 +
    contrast * 0.35
  );

  if (activity > 0.60) return 280;
  if (activity > 0.40) return 390;
  if (activity > 0.25) return 510;
  if (activity > 0.12) return 650;

  return 850;
}

/*
 * Image characteristics also change
 * the brightness of the audio timbre.
 */

function chooseFilter(
  region: Region
): number {
  return Math.round(
    Math.max(
      500,
      Math.min(
        4400,
        700 +
        region.warmth * 2200 +
        region.brightness * 1200 +
        region.contrast * 600 -
        region.coolness * 400
      )
    )
  );
}

/*
 * Main sonification mapping.
 */

export function mapMusic(
  features: FrameFeatures
): MusicalMapping {
  const regions = features.regions;

  if (!regions || regions.length === 0) {
    return {
      steps: [],
      musicalKey: "Image-driven ambient harmony",
    };
  }

  const steps: MusicalStep[] =
    regions.map((region, index) => {
      const previous =
        index > 0
          ? regions[index - 1]
          : null;

      const difference = regionDifference(
        region,
        previous
      );

      /*
       * The existing Tone.js player changes
       * chords every three regions.
       *
       * All three steps in one phrase share
       * a chord derived from their image data.
       */
      const phraseStart =
        Math.floor(index / 3) * 3;

      const harmony = chooseHarmony(
        regions,
        phraseStart
      );

      const intensity = clamp(
        region.brightness * 0.40 +
        region.warmth * 0.35 +
        region.contrast * 0.25
      );

      return {
        note: chooseMelody(
          region,
          previous,
          index
        ),

        chord: harmony.chord,

        bass: harmony.bass,

        durationMs: chooseDuration(
          difference,
          region.contrast
        ),

        filterHz: chooseFilter(region),

        accent:
          difference > 0.14 ||
          region.contrast > 0.35,

        intensity,
      };
    });

  return {
    steps,
    musicalKey:
      "Image-driven ambient harmony",
  };
}
