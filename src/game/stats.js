export function createBattingStats() {
  return {
    games: 0,
    pa: 0,
    ab: 0,
    h: 0,
    bb: 0,
    so: 0,
    hr: 0,
    tb: 0,
    r: 0,
    rbi: 0
  };
}

export function createPitchingStats() {
  return {
    games: 0,
    outs: 0,
    er: 0,
    h: 0,
    bb: 0,
    so: 0
  };
}

export function createStats(role) {
  return role === 'pitcher' ? createPitchingStats() : createBattingStats();
}

export function battingRates(stats) {
  const avg = safeRate(stats.h, stats.ab);
  const obp = safeRate(stats.h + stats.bb, stats.ab + stats.bb);
  const slg = safeRate(stats.tb, stats.ab);
  return {
    avg,
    obp,
    slg,
    ops: obp + slg
  };
}

export function pitchingRates(stats) {
  const innings = stats.outs / 3;
  return {
    era: innings > 0 ? (stats.er * 9) / innings : 0,
    whip: innings > 0 ? (stats.h + stats.bb) / innings : 0,
    innings
  };
}

export function formatAverage(value) {
  if (!Number.isFinite(value)) return '.000';
  return value.toFixed(3).replace(/^0/, '');
}

export function formatFixed(value, digits = 2) {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(digits);
}

export function cloneStats(stats) {
  return JSON.parse(JSON.stringify(stats));
}

function safeRate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}
