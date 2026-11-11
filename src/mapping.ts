
import type { FrameFeatures, Region } from "./analyzeFrame";

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

const clamp = (value: number) =>
  Math.max(0, Math.min(1, value));

// C major pentatonic scale.
// All melody notes belong to the same musical family.
const SCALE = [
  "C4",
  "D4",
  "E4",
  "G4",
  "A4",
  "C5",
  "D5",
  "E5",
  "G5",
];

// Harmonic progression stays coherent across the image.
const CHORDS = [
  {
    notes: ["C3", "E3", "G3"],
    bass: "C2",
  },
  {
    notes: ["A2", "C3", "E3"],
    bass: "A2",
  },
  {
    notes: ["F3", "A3", "C4"],
    bass: "F2",
  },
  {
    notes: ["G2", "B2", "D3"],
    bass: "G2",
  },
];

// Calculate a feature score from actual image analysis.
function getIntensity(region: Region): number {
  return clamp(
    region.brightness * 0.55 +
    region.warmth * 0.35 +
    region.contrast * 0.10
  );
}

// Determine how different neighboring regions are.
function getDifference(
  current: Region,
  previous: Region
): number {
  return clamp(
    Math.abs(current.brightness - previous.brightness) *
      0.30 +
    Math.abs(current.warmth - previous.warmth) *
      0.35 +
    Math.abs(current.coolness - previous.coolness) *
      0.25 +
    Math.abs(current.contrast - previous.contrast) *
      0.10
  );
}

// Select melody notes using image intensity and
// local color changes, instead of intensity alone.
function selectNote(
  region: Region,
  previous: Region | null,
  index: number
): string {
  const intensity = getIntensity(region);

  // Base pitch derived from image features.
  let noteIndex = Math.floor(intensity * SCALE.length);

  // Strong warm regions move the melody upward.
  if (region.warmth > 0.55) {
    noteIndex += 2;
  } else if (region.warmth > 0.30) {
    noteIndex += 1;
  }

  // Cool regions favor the lower register.
  if (region.coolness > 0.45) {
    noteIndex -= 2;
  } else if (region.coolness > 0.25) {
    noteIndex -= 1;
  }

  // Neighboring differences introduce melodic movement.
  if (previous) {
    const difference = getDifference(region, previous);

    if (difference > 0.25) {
      noteIndex += index % 2 === 0 ? 2 : -2;
    } else if (difference > 0.12) {
      noteIndex += index % 2 === 0 ? 1 : -1;
    }
  }

  // Small contrast-based variation.
  // This is deterministic, not random.
  if (region.contrast > 0.32 && index % 3 === 2) {
    noteIndex += 1;
  }

  noteIndex = Math.max(
    0,
    Math.min(SCALE.length - 1, noteIndex)
  );

  return SCALE[noteIndex];
}

// Generate noticeably different note lengths.
// Stable visual regions create spacious phrases;
// changing regions create faster movement.
function getDuration(
  region: Region,
  previous: Region | null
): number {
  if (!previous) {
    return 650;
  }

  const difference = getDifference(region, previous);

  if (difference > 0.35) {
    return 280;
  }

  if (difference > 0.22) {
    return 360;
  }

  if (difference > 0.12) {
    return 470;
  }

  if (region.contrast > 0.25) {
    return 580;
  }

  return 760;
}

// Image-driven timbre:
// More warm-colored pixels open the audio filter.
// Cooler, darker regions produce a softer texture.
function getFilterFrequency(region: Region): number {
  const frequency =
    550 +
    region.warmth * 2400 +
    region.brightness * 1200 +
    region.contrast * 450 -
    region.coolness * 350;

  return Math.round(
    Math.max(450, Math.min(4300, frequency))
  );
}

// Accent notes occur when neighboring regions
// differ significantly or contain strong contrast.
function shouldAccent(
  region: Region,
  previous: Region | null,
  index: number
): boolean {
  if (!previous) return false;

  const difference = getDifference(region, previous);

  return (
    difference > 0.16 ||
    (region.contrast > 0.30 && index % 2 === 0)
  );
}

/**
 * Converts visual-frame features into a musical sequence.
 *
 * Input:
 *   Actual Canvas 2D measurements.
 *
 * Output:
 *   Melody, harmony, bass, note durations,
 *   timbre and rhythmic accents.
 *
 * This is visual-feature sonification.
 * It does not claim to measure temperature directly.
 */
export function mapMusic(
  features: FrameFeatures
): MusicalMapping {
  const regions = features.regions;

  if (!regions || regions.length === 0) {
    return {
      steps: [],
      musicalKey: "C major pentatonic / ambient",
    };
  }

  const steps: MusicalStep[] = regions.map(
    (region, index) => {
      const previous =
        index > 0 ? regions[index - 1] : null;

      const intensity = getIntensity(region);

      // Four three-step harmonic phrases.
      // The progression stays musical while
      // the image determines the changing melody.
      const chordIndex = Math.min(
        CHORDS.length - 1,
        Math.floor(
          (index / regions.length) * CHORDS.length
        )
      );

      const harmony = CHORDS[chordIndex];

      return {
        note: selectNote(region, previous, index),

        chord: harmony.notes,

        bass: harmony.bass,

        durationMs: getDuration(region, previous),

        filterHz: getFilterFrequency(region),

        accent: shouldAccent(
          region,
          previous,
          index
        ),

        intensity,
      };
    }
  );

  return {
    steps,
    musicalKey: "C major pentatonic / ambient",
  };
}
