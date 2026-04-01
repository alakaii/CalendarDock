/** Returns a CSS gradient string keyed to the current month (0-indexed). */
export function getSeasonalGradient(month: number): string {
  if (month >= 2 && month <= 4) {
    // Spring (Mar–May): soft greens & cherry-blossom pinks
    return 'linear-gradient(120deg, rgba(167,243,208,0.10) 0%, rgba(249,168,212,0.14) 45%, rgba(134,239,172,0.18) 100%)'
  }
  if (month >= 5 && month <= 7) {
    // Summer (Jun–Aug): warm golden amber
    return 'linear-gradient(120deg, rgba(253,224,71,0.08) 0%, rgba(251,146,60,0.13) 45%, rgba(253,224,71,0.16) 100%)'
  }
  if (month >= 8 && month <= 10) {
    // Autumn (Sep–Nov): burnt orange & harvest red
    return 'linear-gradient(120deg, rgba(234,179,8,0.09) 0%, rgba(239,68,68,0.13) 45%, rgba(251,146,60,0.20) 100%)'
  }
  // Winter (Dec, Jan, Feb): cool ice-blue & soft violet
  return 'linear-gradient(120deg, rgba(147,197,253,0.09) 0%, rgba(196,181,253,0.14) 45%, rgba(147,197,253,0.18) 100%)'
}
