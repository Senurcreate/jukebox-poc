import type { FrameFeatures, Region } from './analyzeFrame';

// C major pentatonic: harmonic choices make changing data easier to listen to.
const SCALE = ['C4','D4','E4','G4','A4','C5','D5','E5','G5'];
export type MusicalStep = {
  note: string;
  chord: string[];
  bass: string;
  durationMs: number;
  filterHz: number;
  accent: boolean;
  intensity: number;
};
export type MusicalMapping = { steps: MusicalStep[]; musicalKey: string; };
const clamp = (x:number)=>Math.max(0,Math.min(1,x));
const CHORDS = [
  { notes:['C3','E3','G3'],bass:'C2' },
  { notes:['A2','C3','E3'],bass:'A2' },
  { notes:['F3','A3','C4'],bass:'F2' },
  { notes:['G2','B2','D3'],bass:'G2' },
];
/** Each horizontal position is one musical step, sampled from the corresponding vertical strip. */
export function mapMusic(features: FrameFeatures): MusicalMapping {
  return {
    musicalKey:'C major pentatonic / ambient',
    steps:features.regions.map((r:Region,i:number,arr:Region[])=>{
      const combined = clamp(.55*r.brightness+.35*r.warmth+.10*r.contrast);
      const idx = Math.min(SCALE.length-1,Math.floor(combined*SCALE.length));
      const delta = i===0 ? 0 : Math.abs(r.brightness-arr[i-1].brightness) + Math.abs(r.warmth-arr[i-1].warmth)*.5;
      const chord = CHORDS[Math.min(3,Math.floor(i/3))];
      return {
        note:SCALE[idx], chord:chord.notes, bass:chord.bass,
        durationMs: Math.round(510-155*clamp(delta)),
        filterHz:Math.round(850+2300*clamp(r.warmth*.8+r.brightness*.2)),
        accent:delta>.14,
        intensity:combined
      };
    })
  };
}
