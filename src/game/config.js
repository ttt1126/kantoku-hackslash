export const CONFIG = {
  schemaVersion: 1,
  storageKey: 'kantoku-hackslash-save-v1',
  season: {
    rounds: 8,
    gamesPerRound: 3,
    playoffRankCutoff: 3,
    offseasonActions: 3
  },
  match: {
    managerPoints: 3,
    regularInningsBeforeDecision: 6,
    maxExtraInnings: 12,
    postseasonOpponentBoost: 7,
    playerOpeningBoost: 4
  },
  draft: {
    maxPlayerPicks: 3,
    baseCandidateCount: 12,
    aiPickAfterPlayerPick: 1,
    currentAbilityNoise: 3,
    basePotentialRange: 14,
    scoutedPotentialRange: 7
  },
  roster: {
    initialHitters: 10,
    initialPitchers: 6,
    minimumHitters: 9,
    minimumPitchers: 4,
    retireAgeFloor: 36,
    forcedRetireAge: 42
  },
  equipment: {
    tacticSlots: 3,
    trainingSlots: 3
  },
  inventory: {
    itemSlots: 5
  },
  economy: {
    startingFunds: 120,
    strongRewardCost: 35,
    postseasonRewardFunds: 60
  },
  rewards: {
    rarityWeights: {
      light: { normal: 72, quality: 23, masterwork: 5 },
      strong: { normal: 18, quality: 55, masterwork: 27 },
      final: { normal: 8, quality: 54, masterwork: 38 },
      postseason: { normal: 0, quality: 45, masterwork: 55 }
    }
  },
  legacy: {
    normalClearPoints: 3,
    hardRewards: [
      { value: 3, points: 1 },
      { value: 6, points: 1 },
      { value: 10, points: 2 },
      { value: 15, points: 2 },
      { value: 21, points: 3 },
      { value: 28, points: 3 }
    ]
  }
};

export const PHASE_LABELS = {
  title: 'タイトル',
  draft: 'ドラフト',
  equipment: '作戦準備',
  dashboard: '年間進行',
  match: '試合',
  reward: 'ラウンド報酬',
  postseason: 'ポストシーズン',
  awards: '表彰と世代交代',
  offseason: 'オフシーズン'
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
