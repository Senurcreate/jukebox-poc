/** Visual-frame measurements, NOT a temperature dataset. All values in 0..1. */
export type Region = { brightness: number; warmth: number; coolness: number; contrast: number };
export type FrameFeatures = {
  regions: Region[];
  brightness: number;
  warmth: number;
  coolness: number;
  contrast: number;
  sampledPixels: number;
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const COUNT = 12;

export async function analyzeFrame(src: string): Promise<FrameFeatures> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 112;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const totals = Array.from({length: COUNT}, () => ({lum:0,lumSq:0,warm:0,cool:0,n:0}));
  let samples = 0;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const offset = (y * canvas.width + x) * 4;
      const r = data[offset] / 255, g = data[offset+1] / 255, b = data[offset+2] / 255;
      if (data[offset+3] < 128) continue;
      const luminance = 0.2126*r + 0.7152*g + 0.0722*b;
      const bin = Math.min(COUNT - 1, Math.floor(x / (canvas.width/COUNT)));
      const item = totals[bin];
      item.lum += luminance;
      item.lumSq += luminance*luminance;
      // Artistic hue families only; not scientifically decoded temperatures.
      item.warm += (r > b*1.18 && r > g*1.07 && r > .25) ? 1 : 0;
      item.cool += (b > r*1.15 && b > g*1.04 && b > .22) ? 1 : 0;
      item.n++;samples++;
    }
  }
  if (samples === 0) throw new Error('No pixels could be analyzed.');
  const regions = totals.map(t => {
    const n = Math.max(1,t.n);
    const brightness = t.lum/n;
    const variance = Math.max(0,t.lumSq/n-brightness*brightness);
    return {brightness, warmth:t.warm/n, coolness:t.cool/n, contrast:clamp(Math.sqrt(variance)*2.2)};
  });
  const mean = (key: keyof Region) => regions.reduce((s,r)=>s+r[key],0)/regions.length;
  return {regions, brightness:mean('brightness'), warmth:mean('warmth'), coolness:mean('coolness'), contrast:mean('contrast'), sampledPixels:samples};
}
