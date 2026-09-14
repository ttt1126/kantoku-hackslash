import { CONFIG, PHASE_LABELS, clamp } from './config.js';
import {
  CONSUMABLE_ITEMS,
  FAMILY_NAMES,
  GIVEN_NAMES,
  GROWTH_TYPES,
  HARD_CONDITIONS,
  HITTER_POSITIONS,
  LEGACY_PERKS,
  MANAGER_ABILITIES,
  PITCHER_POSITIONS,
  PLAYER_TRAITS,
  SCOUT_REPORTS,
  TACTICS,
  TEAMS,
  TRAINING_PLANS
} from './data.js';
import { chance, createRng, pick, randomFloat, randomInt, shuffle, weightedPick } from './rng.js';
import { battingRates, cloneStats, createStats, pitchingRates } from './stats.js';

export function createNewGame(options = {}) {
  const rng = createRng(options.seed ?? `${Date.now()}`);
  const teamId = options.teamId ?? TEAMS[0].id;
  const state = {
    schemaVersion: CONFIG.schemaVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rng,
    manager: {
      name: options.managerName?.trim() || '新人監督',
      style: options.style || 'バランス型',
      abilities: {},
      legacy: {
        famePoints: 0,
        spentPoints: 0,
        perks: {},
        normalCleared: false,
        hardUnlocked: false,
        highestHardValue: 0,
        claimedHardRewards: []
      },
      hardConditions: []
    },
    teamId,
    year: 1,
    phase: 'draft',
    round: 0,
    gameInRound: 0,
    funds: CONFIG.economy.startingFunds,
    materials: 0,
    teams: createTeamRecords(teamId, rng),
    roster: generateInitialRoster(rng),
    retiredPlayers: [],
    draft: null,
    equipment: {
      tactics: TACTICS.slice(0, CONFIG.equipment.tacticSlots).map((item) => item.id),
      training: TRAINING_PLANS.slice(0, CONFIG.equipment.trainingSlots).map((item) => item.id)
    },
    unlocked: {
      tactics: TACTICS.slice(0, 4).map((item) => item.id),
      training: TRAINING_PLANS.slice(0, 4).map((item) => item.id),
      items: CONSUMABLE_ITEMS.map((item) => item.id)
    },
    inventory: [],
    modifiers: createSeasonModifiers(),
    currentMatch: null,
    rewardOffer: null,
    postseason: null,
    awards: null,
    offseason: null,
    matchHistory: [],
    seasonLog: ['初年度ドラフトから監督生活が始まった。']
  };

  ensureRosterDepth(state);
  prepareDraft(state);
  return state;
}

export function createSeasonModifiers() {
  return {
    scoutCandidateBonus: 0,
    scoutAccuracyBonus: 0,
    nextDraftElite: false,
    preventDeclineThisSeason: false,
    nextRewardExtraRecruit: false,
    extraTrainingSlotsThisSeason: 0,
    usedTemporaryTrainingSlot: false
  };
}

export function getPhaseLabel(state) {
  return PHASE_LABELS[state.phase] ?? state.phase;
}

export function getTeamDefinition(teamId) {
  return TEAMS.find((team) => team.id === teamId);
}

export function getPlayerTeam(state) {
  return state.teams.find((team) => team.id === state.teamId);
}

export function getLeagueStandings(state, leagueId = getTeamDefinition(state.teamId)?.league) {
  return state.teams
    .filter((team) => getTeamDefinition(team.id)?.league === leagueId)
    .sort((a, b) => b.wins - a.wins || b.runDiff - a.runDiff || a.losses - b.losses);
}

export function getPlayerRank(state) {
  const standings = getLeagueStandings(state);
  return standings.findIndex((team) => team.id === state.teamId) + 1;
}

export function calculateHardValue(state) {
  return state.manager.hardConditions.reduce((sum, id) => {
    const condition = HARD_CONDITIONS.find((item) => item.id === id);
    return sum + (condition?.value ?? 0);
  }, 0);
}

export function hasHardCondition(state, id) {
  return state.manager.hardConditions.includes(id);
}

export function getLegacyPerkLevel(state, id) {
  return state.manager.legacy.perks[id] ?? 0;
}

export function getAvailableFamePoints(state) {
  return state.manager.legacy.famePoints - state.manager.legacy.spentPoints;
}

export function getTacticSlots(state) {
  const legacy = getLegacyPerkLevel(state, 'legacy-tactic-slot');
  const ability = state.manager.abilities['tactics-board'] ?? 0;
  const hardPenalty = hasHardCondition(state, 'tactic-slot-down') ? 1 : 0;
  return Math.max(1, CONFIG.equipment.tacticSlots + legacy + ability - hardPenalty);
}

export function getTrainingSlots(state) {
  const legacy = getLegacyPerkLevel(state, 'legacy-training-slot');
  const hardPenalty = hasHardCondition(state, 'training-slot-down') ? 1 : 0;
  return Math.max(
    1,
    CONFIG.equipment.trainingSlots + legacy + (state.modifiers.extraTrainingSlotsThisSeason ?? 0) - hardPenalty
  );
}

export function getDraftPickLimit(state) {
  const hardPenalty = hasHardCondition(state, 'draft-minus') ? 1 : 0;
  return Math.max(1, CONFIG.draft.maxPlayerPicks - hardPenalty);
}

export function getManagerPoints(state) {
  const ability = state.manager.abilities['extra-point'] ?? 0;
  return CONFIG.match.managerPoints + ability;
}

export function getOffseasonActionLimit(state) {
  const hardPenalty = hasHardCondition(state, 'offseason-minus') ? 1 : 0;
  return Math.max(1, CONFIG.season.offseasonActions - hardPenalty);
}

export function getTrainingEffects(state) {
  const effects = {};
  for (const id of state.equipment.training) {
    const plan = TRAINING_PLANS.find((item) => item.id === id);
    if (!plan) continue;
    for (const [key, value] of Object.entries(plan.effects)) {
      effects[key] = (effects[key] ?? 0) + value;
    }
  }
  return effects;
}

export function playerOverall(player) {
  const values = Object.values(player.abilities);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function hitterScore(player, training = {}) {
  if (player.role !== 'hitter') return 0;
  return (
    effectiveAbility(player, 'contact', training) * 0.28 +
    effectiveAbility(player, 'power', training) * 0.24 +
    effectiveAbility(player, 'eye', training) * 0.2 +
    effectiveAbility(player, 'speed', training) * 0.12 +
    effectiveAbility(player, 'fielding', training) * 0.1 +
    effectiveAbility(player, 'arm', training) * 0.06
  );
}

export function pitcherScore(player, training = {}) {
  if (player.role !== 'pitcher') return 0;
  return (
    effectiveAbility(player, 'power', training) * 0.3 +
    effectiveAbility(player, 'control', training) * 0.28 +
    effectiveAbility(player, 'breaking', training) * 0.24 +
    effectiveAbility(player, 'stamina', training) * 0.12 +
    effectiveAbility(player, 'fielding', training) * 0.06
  );
}

export function teamPower(state) {
  const training = getTrainingEffects(state);
  const hitters = state.roster
    .filter((player) => player.role === 'hitter')
    .sort((a, b) => hitterScore(b, training) - hitterScore(a, training))
    .slice(0, 9);
  const pitchers = state.roster
    .filter((player) => player.role === 'pitcher')
    .sort((a, b) => pitcherScore(b, training) - pitcherScore(a, training))
    .slice(0, 4);
  const offense = average(hitters.map((player) => hitterScore(player, training))) + CONFIG.match.playerOpeningBoost;
  const pitching = average(pitchers.map((player) => pitcherScore(player, training))) + CONFIG.match.playerOpeningBoost;
  const defense = average(
    hitters.map((player) => effectiveAbility(player, 'fielding', training)).concat(
      pitchers.map((player) => effectiveAbility(player, 'fielding', training))
    )
  );
  const speed = average(hitters.map((player) => effectiveAbility(player, 'speed', training)));
  return {
    offense,
    pitching,
    defense,
    speed,
    overall: offense * 0.42 + pitching * 0.42 + defense * 0.1 + speed * 0.06
  };
}

export function prepareDraft(state) {
  const rng = state.rng;
  const count =
    CONFIG.draft.baseCandidateCount +
    getLegacyPerkLevel(state, 'legacy-draft') +
    (state.manager.abilities['scout-network'] ?? 0) +
    (state.modifiers.scoutCandidateBonus ?? 0);
  const accuracy =
    (state.modifiers.scoutAccuracyBonus ?? 0) +
    (state.manager.abilities['scout-network'] ?? 0) +
    getLegacyPerkLevel(state, 'legacy-draft');
  const pool = [];
  const eliteIndex = state.modifiers.nextDraftElite ? randomInt(rng, 0, Math.max(0, count - 1)) : -1;

  for (let index = 0; index < count; index += 1) {
    pool.push(generateDraftCandidate(rng, { elite: index === eliteIndex, accuracy }));
  }

  state.draft = {
    year: state.year,
    maxPicks: getDraftPickLimit(state),
    picks: [],
    pool,
    aiLog: [],
    scoutLevel: accuracy
  };
  state.modifiers.nextDraftElite = false;
  state.modifiers.scoutCandidateBonus = 0;
  state.modifiers.scoutAccuracyBonus = 0;
  state.phase = 'draft';
  touch(state);
  return state.draft;
}

export function draftPlayer(state, candidateId) {
  assertPhase(state, 'draft');
  if (!state.draft) throw new Error('ドラフトが準備されていません。');
  if (state.draft.picks.length >= state.draft.maxPicks) {
    throw new Error('ドラフト獲得上限に達しています。');
  }
  const index = state.draft.pool.findIndex((candidate) => candidate.id === candidateId);
  if (index < 0) throw new Error('候補が見つかりません。');
  const [candidate] = state.draft.pool.splice(index, 1);
  const player = createPlayerFromCandidate(candidate, state.year);
  state.roster.push(player);
  state.draft.picks.push(player.id);
  state.seasonLog.unshift(`${candidate.name}をドラフトで指名した。`);

  for (let count = 0; count < CONFIG.draft.aiPickAfterPlayerPick; count += 1) {
    runAiDraftPick(state);
  }

  if (state.draft.picks.length >= state.draft.maxPicks) {
    state.phase = 'equipment';
  }
  touch(state);
  return player;
}

export function skipDraft(state) {
  assertPhase(state, 'draft');
  state.phase = 'equipment';
  state.seasonLog.unshift('残りのドラフト指名を見送った。');
  touch(state);
}

export function runAiDraftPick(state) {
  if (!state.draft?.pool.length) return null;
  const draftOrder = [...state.teams].sort((a, b) => a.wins - b.wins || b.losses - a.losses);
  const aiTeams = draftOrder.filter((team) => team.id !== state.teamId);
  const team = aiTeams[state.draft.aiLog.length % aiTeams.length];
  const index = state.draft.pool.reduce((bestIndex, candidate, currentIndex, pool) => {
    const best = pool[bestIndex];
    const score = candidate.potential * 0.65 + candidate.currentOverall * 0.35;
    const bestScore = best.potential * 0.65 + best.currentOverall * 0.35;
    return score > bestScore ? currentIndex : bestIndex;
  }, 0);
  const [candidate] = state.draft.pool.splice(index, 1);
  state.draft.aiLog.unshift({
    teamId: team.id,
    teamName: getTeamDefinition(team.id)?.shortName ?? team.id,
    candidateName: candidate.name,
    position: candidate.position
  });
  return candidate;
}

export function startSeasonAfterDraft(state) {
  if (!['draft', 'equipment'].includes(state.phase)) {
    throw new Error('シーズン準備中のみ開始できます。');
  }
  ensureRosterDepth(state);
  trimEquipmentToSlots(state);
  state.round = 1;
  state.gameInRound = 0;
  state.phase = 'dashboard';
  state.rewardOffer = null;
  state.currentMatch = null;
  state.seasonLog.unshift(`${state.year}年シーズンが開幕した。`);
  touch(state);
}

export function equipTactic(state, tacticId) {
  if (!state.unlocked.tactics.includes(tacticId)) throw new Error('未解放の作戦です。');
  if (state.equipment.tactics.includes(tacticId)) return;
  if (state.equipment.tactics.length >= getTacticSlots(state)) throw new Error('作戦装備枠が足りません。');
  state.equipment.tactics.push(tacticId);
  touch(state);
}

export function unequipTactic(state, tacticId) {
  state.equipment.tactics = state.equipment.tactics.filter((id) => id !== tacticId);
  touch(state);
}

export function equipTraining(state, trainingId) {
  if (!state.unlocked.training.includes(trainingId)) throw new Error('未解放の練習方針です。');
  if (state.equipment.training.includes(trainingId)) return;
  if (state.equipment.training.length >= getTrainingSlots(state)) throw new Error('練習方針装備枠が足りません。');
  state.equipment.training.push(trainingId);
  touch(state);
}

export function unequipTraining(state, trainingId) {
  state.equipment.training = state.equipment.training.filter((id) => id !== trainingId);
  touch(state);
}

export function toggleHardCondition(state, conditionId) {
  if (!state.manager.legacy.hardUnlocked) throw new Error('ハード条件はノーマル日本一後に解放されます。');
  if (!HARD_CONDITIONS.some((condition) => condition.id === conditionId)) throw new Error('不明なハード条件です。');
  if (!['draft', 'equipment', 'dashboard'].includes(state.phase) || state.round > 1 || state.gameInRound > 0) {
    throw new Error('ハード条件はシーズン開始前に変更してください。');
  }
  if (state.manager.hardConditions.includes(conditionId)) {
    state.manager.hardConditions = state.manager.hardConditions.filter((id) => id !== conditionId);
  } else {
    state.manager.hardConditions.push(conditionId);
  }
  trimEquipmentToSlots(state);
  touch(state);
}

export function purchaseLegacyPerk(state, perkId) {
  const perk = LEGACY_PERKS.find((item) => item.id === perkId);
  if (!perk) throw new Error('不明な名将パークです。');
  const current = getLegacyPerkLevel(state, perkId);
  if (current >= perk.maxLevel) throw new Error('これ以上強化できません。');
  if (getAvailableFamePoints(state) < perk.cost) throw new Error('名将ポイントが足りません。');
  state.manager.legacy.perks[perkId] = current + 1;
  state.manager.legacy.spentPoints += perk.cost;
  touch(state);
}

export function resetLegacyPerks(state) {
  state.manager.legacy.perks = {};
  state.manager.legacy.spentPoints = 0;
  trimEquipmentToSlots(state);
  touch(state);
}

function createTeamRecords(playerTeamId, rng) {
  return TEAMS.map((team) => {
    const isPlayer = team.id === playerTeamId;
    const rating = team.baseRating + randomInt(rng, -3, 3) + (isPlayer ? CONFIG.match.playerOpeningBoost : 0);
    return {
      id: team.id,
      wins: 0,
      losses: 0,
      runsFor: 0,
      runsAgainst: 0,
      runDiff: 0,
      rating
    };
  });
}

function generateInitialRoster(rng) {
  const roster = [];
  for (let index = 0; index < CONFIG.roster.initialHitters; index += 1) {
    roster.push(generatePlayer(rng, 'hitter', 22 + (index % 11), false));
  }
  for (let index = 0; index < CONFIG.roster.initialPitchers; index += 1) {
    roster.push(generatePlayer(rng, 'pitcher', 23 + (index % 10), false));
  }
  return roster;
}

function generatePlayer(rng, role, age = randomInt(rng, 18, 34), rookie = false) {
  const base = rookie ? randomInt(rng, 42, 61) : randomInt(rng, 45, 70);
  const potential = clamp(base + randomInt(rng, rookie ? 10 : 2, rookie ? 32 : 18), 45, 96);
  const position = role === 'pitcher' ? pick(rng, PITCHER_POSITIONS) : HITTER_POSITIONS[randomInt(rng, 0, HITTER_POSITIONS.length - 1)];
  return {
    id: makeId(role, rng),
    name: createName(rng),
    role,
    age,
    batsThrows: createBatsThrows(rng, role),
    position,
    abilities: role === 'pitcher' ? pitcherAbilities(rng, base) : hitterAbilities(rng, base),
    potential,
    growthType: pick(rng, GROWTH_TYPES).id,
    injuryRisk: randomInt(rng, 8, 46),
    traits: shuffle(rng, PLAYER_TRAITS).slice(0, chance(rng, 0.22) ? 2 : 1),
    condition: randomInt(rng, -4, 6),
    fatigue: randomInt(rng, 0, 8),
    xp: 0,
    joinedYear: rookie ? undefined : 1,
    contractUntilYear: null,
    rejuvenated: false,
    stats: createStats(role),
    history: []
  };
}

function generateDraftCandidate(rng, { elite = false, accuracy = 0 } = {}) {
  const role = chance(rng, 0.38) ? 'pitcher' : 'hitter';
  const currentBase = elite ? randomInt(rng, 58, 72) : randomInt(rng, 38, 63);
  const potential = clamp(currentBase + randomInt(rng, elite ? 18 : 5, elite ? 32 : 28), 45, 98);
  const position = role === 'pitcher' ? pick(rng, PITCHER_POSITIONS) : pick(rng, HITTER_POSITIONS);
  const abilities = role === 'pitcher' ? pitcherAbilities(rng, currentBase) : hitterAbilities(rng, currentBase);
  const currentOverall = Math.round(average(Object.values(abilities)));
  const potentialSpread = Math.max(
    3,
    CONFIG.draft.basePotentialRange - accuracy * 2 + randomInt(rng, -2, 2)
  );
  const injurySpread = Math.max(5, 22 - accuracy * 3);
  const injuryRisk = randomInt(rng, 5, 48);
  return {
    id: makeId('cand', rng),
    name: createName(rng),
    role,
    age: randomInt(rng, 18, 22),
    batsThrows: createBatsThrows(rng, role),
    position,
    abilities,
    currentOverall: clamp(currentOverall + randomInt(rng, -CONFIG.draft.currentAbilityNoise, CONFIG.draft.currentAbilityNoise), 1, 100),
    potential,
    potentialRange: [
      clamp(potential - potentialSpread, 1, 100),
      clamp(potential + potentialSpread, 1, 100)
    ],
    growthType: pick(rng, GROWTH_TYPES).id,
    injuryRisk,
    injuryRange: injuryRiskRange(injuryRisk, injurySpread),
    traits: shuffle(rng, PLAYER_TRAITS).slice(0, chance(rng, elite ? 0.45 : 0.2) ? 2 : 1),
    scoutReport: pick(rng, SCOUT_REPORTS)
  };
}

function createPlayerFromCandidate(candidate, year) {
  return {
    id: candidate.id.replace('cand', 'ply'),
    name: candidate.name,
    role: candidate.role,
    age: candidate.age,
    batsThrows: candidate.batsThrows,
    position: candidate.position,
    abilities: { ...candidate.abilities },
    potential: candidate.potential,
    growthType: candidate.growthType,
    injuryRisk: candidate.injuryRisk,
    traits: [...candidate.traits],
    condition: 2,
    fatigue: 0,
    xp: 0,
    joinedYear: year,
    contractUntilYear: null,
    rejuvenated: false,
    stats: createStats(candidate.role),
    history: []
  };
}

function hitterAbilities(rng, base) {
  return {
    contact: abilityAround(rng, base),
    power: abilityAround(rng, base),
    eye: abilityAround(rng, base),
    speed: abilityAround(rng, base),
    fielding: abilityAround(rng, base),
    arm: abilityAround(rng, base),
    durability: abilityAround(rng, base + 5)
  };
}

function pitcherAbilities(rng, base) {
  return {
    power: abilityAround(rng, base),
    control: abilityAround(rng, base),
    breaking: abilityAround(rng, base),
    stamina: abilityAround(rng, base),
    fielding: abilityAround(rng, base - 2),
    durability: abilityAround(rng, base + 5)
  };
}

function abilityAround(rng, base) {
  return clamp(base + randomInt(rng, -9, 9), 20, 96);
}

function createName(rng) {
  return `${pick(rng, FAMILY_NAMES)} ${pick(rng, GIVEN_NAMES)}`;
}

function createBatsThrows(rng, role) {
  const throws = chance(rng, 0.28) ? '左投' : '右投';
  if (role === 'pitcher') return throws;
  const bats = chance(rng, 0.34) ? '左打' : chance(rng, 0.08) ? '両打' : '右打';
  return `${throws}${bats}`;
}

function injuryRiskRange(value, spread) {
  const low = injuryLabel(clamp(value - spread, 0, 100));
  const high = injuryLabel(clamp(value + spread, 0, 100));
  return low === high ? low : `${low}〜${high}`;
}

function injuryLabel(value) {
  if (value < 18) return '低';
  if (value < 36) return '中';
  if (value < 58) return '高';
  return '危険';
}

function makeId(prefix, rng) {
  return `${prefix}_${Math.floor(randomFloat(rng) * 0xffffffff).toString(36)}`;
}

function effectiveAbility(player, key, training = {}) {
  const trainingKeyMap = {
    power: 'power',
    contact: 'contact',
    eye: 'eye',
    speed: 'speed',
    fielding: 'fielding',
    arm: 'arm'
  };
  const base = player.abilities[key] ?? 50;
  const trainingBoost = training[trainingKeyMap[key]] ?? 0;
  const conditionBoost = (player.condition ?? 0) * 0.7;
  const fatiguePenalty = (player.fatigue ?? 0) * 0.16;
  return clamp(base + trainingBoost + conditionBoost - fatiguePenalty, 1, 100);
}

function average(values) {
  if (!values.length) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assertPhase(state, phase) {
  if (state.phase !== phase) throw new Error(`${PHASE_LABELS[phase] ?? phase}中のみ実行できます。`);
}

function touch(state) {
  state.updatedAt = new Date().toISOString();
}

function trimEquipmentToSlots(state) {
  state.equipment.tactics = state.equipment.tactics.slice(0, getTacticSlots(state));
  state.equipment.training = state.equipment.training.slice(0, getTrainingSlots(state));
}

export function startNextGame(state) {
  if (state.phase !== 'dashboard') throw new Error('通常ラウンド中のみ試合を開始できます。');
  const opponent = chooseRegularOpponent(state);
  state.currentMatch = createMatch(state, {
    kind: 'regular',
    opponentId: opponent.id,
    opponentName: getTeamDefinition(opponent.id)?.name ?? opponent.id,
    opponentRating: opponent.rating
  });
  state.phase = 'match';
  touch(state);
}

export function startPostseasonGame(state) {
  if (state.phase !== 'postseason') throw new Error('ポストシーズン中のみ試合を開始できます。');
  if (!state.postseason) throw new Error('ポストシーズン情報がありません。');
  const opponent = state.teams.find((team) => team.id === state.postseason.opponentId);
  state.currentMatch = createMatch(state, {
    kind: 'postseason',
    opponentId: opponent.id,
    opponentName: getTeamDefinition(opponent.id)?.name ?? opponent.id,
    opponentRating: opponent.rating + CONFIG.match.postseasonOpponentBoost + Math.floor(calculateHardValue(state) / 3)
  });
  state.phase = 'match';
  touch(state);
}

export function getInstructionOptions(state) {
  if (!state.currentMatch) return [];
  const hold = {
    id: 'hold',
    name: '静観',
    cost: 0,
    summary: '監督ポイントを温存し、現在の戦力だけで進める。',
    expectedDelta: 0,
    effectsText: '期待値変化なし'
  };
  const tactics = state.equipment.tactics
    .map((id) => TACTICS.find((item) => item.id === id))
    .filter(Boolean)
    .map((tactic) => {
      const expectedDelta = estimateTacticDelta(state.currentMatch.context, tactic);
      return {
        id: tactic.id,
        name: tactic.name,
        cost: tactic.cost,
        summary: tactic.summary,
        expectedDelta,
        disabled: tactic.cost > state.currentMatch.managerPoints,
        effectsText: expectedDelta >= 0 ? `得点期待 +${expectedDelta.toFixed(2)}` : `得点期待 ${expectedDelta.toFixed(2)}`
      };
    });
  return [hold, ...tactics];
}

export function applyMatchInstruction(state, tacticId = 'hold') {
  assertPhase(state, 'match');
  const match = state.currentMatch;
  if (!match) throw new Error('進行中の試合がありません。');
  const tactic = tacticId === 'hold' ? null : TACTICS.find((item) => item.id === tacticId);
  if (tactic && !state.equipment.tactics.includes(tactic.id)) throw new Error('装備していない作戦です。');
  if (tactic && tactic.cost > match.managerPoints) throw new Error('監督ポイントが足りません。');

  const effects = tactic ? { ...tactic.effects } : {};
  if (tactic) match.managerPoints -= tactic.cost;
  match.selectedInstruction = tactic ? tactic.name : '静観';
  match.expectedDelta = tactic ? estimateTacticDelta(match.context, tactic) : 0;
  match.log.push(`${match.context.label}で${match.selectedInstruction}を選択した。`);

  const opponent = {
    id: match.opponentId,
    rating: match.opponentRating
  };
  const lineup = selectLineup(state);
  const pitcher = state.roster.find((player) => player.id === match.pitcherId) ?? selectPitcher(state);
  let inning = match.inning;
  while (inning <= 9) {
    const result = simulateInning(state, lineup, pitcher, opponent, effects, match.hitterIndex);
    match.hitterIndex = result.hitterIndex;
    match.playerScore += result.playerRuns;
    match.opponentScore += result.opponentRuns;
    inning += 1;
  }

  while (match.playerScore === match.opponentScore && inning <= CONFIG.match.maxExtraInnings) {
    const result = simulateInning(state, lineup, pitcher, opponent, effects, match.hitterIndex);
    match.hitterIndex = result.hitterIndex;
    match.playerScore += result.playerRuns;
    match.opponentScore += result.opponentRuns;
    inning += 1;
  }

  if (match.playerScore === match.opponentScore) {
    if (teamPower(state).overall >= match.opponentRating) match.playerScore += 1;
    else match.opponentScore += 1;
  }

  const playerWon = match.playerScore > match.opponentScore;
  applyPostGameFatigue(state, effects);
  awardGameExperience(state, playerWon);
  recordMatchHistory(state, match, playerWon);

  if (match.kind === 'postseason') {
    recordPostseasonResult(state, playerWon, {
      playerScore: match.playerScore,
      opponentScore: match.opponentScore
    });
  } else {
    finishRegularGame(state, match, playerWon);
  }

  state.currentMatch = null;
  touch(state);
}

export function recordPostseasonResult(state, playerWon, score = { playerScore: 0, opponentScore: 0 }) {
  if (!state.postseason) throw new Error('ポストシーズン情報がありません。');
  const stage = state.postseason.stage;
  if (playerWon) state.postseason.playerWins += 1;
  else state.postseason.opponentWins += 1;
  state.postseason.log.unshift(
    `${stage === 'cs' ? 'CS' : '日本シリーズ'} ${score.playerScore}-${score.opponentScore} ${
      playerWon ? '勝利' : '敗戦'
    }`
  );

  if (stage === 'cs') {
    if (state.postseason.playerWins >= 2) {
      const opponent = chooseJapanSeriesOpponent(state);
      state.postseason = {
        stage: 'japanSeries',
        playerWins: 0,
        opponentWins: 0,
        opponentId: opponent.id,
        log: ['CSを突破した。日本シリーズが始まる。']
      };
      state.phase = 'postseason';
      return;
    }
    if (state.postseason.opponentWins >= 2) {
      processSeasonEnd(state, { champion: false, reason: 'CS敗退' });
      return;
    }
    state.phase = 'postseason';
    return;
  }

  if (stage === 'japanSeries') {
    if (state.postseason.playerWins >= 4) {
      processSeasonEnd(state, { champion: true, reason: '日本一' });
      return;
    }
    if (state.postseason.opponentWins >= 4) {
      processSeasonEnd(state, { champion: false, reason: '日本シリーズ敗退' });
      return;
    }
    state.phase = 'postseason';
  }
}

export function rollRewardRarity(rng, tier = 'light') {
  const weights = CONFIG.rewards.rarityWeights[tier] ?? CONFIG.rewards.rarityWeights.light;
  return weightedPick(
    rng,
    Object.entries(weights).map(([value, weight]) => ({ value, weight }))
  );
}

export function selectRewardRarity(roll, tier = 'light') {
  const weights = CONFIG.rewards.rarityWeights[tier] ?? CONFIG.rewards.rarityWeights.light;
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  let cursor = clamp(roll, 0, 0.999999) * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    cursor -= weight;
    if (cursor <= 0) return rarity;
  }
  return Object.keys(weights).at(-1);
}

export function createRewardOffer(state, tier) {
  const options = Array.from({ length: 3 }, () => createRewardOption(state, tier));
  return {
    id: makeId('reward', state.rng),
    tier,
    cost: tier === 'strong' ? CONFIG.economy.strongRewardCost : 0,
    options
  };
}

export function claimReward(state, rewardId) {
  assertPhase(state, 'reward');
  const offer = state.rewardOffer;
  if (!offer) throw new Error('報酬がありません。');
  const reward = offer.options.find((item) => item.id === rewardId);
  if (!reward) throw new Error('報酬候補が見つかりません。');
  if (offer.cost > 0) {
    if (state.funds < offer.cost) throw new Error('球団資金が足りません。');
    state.funds -= offer.cost;
  }
  applyReward(state, reward);
  state.rewardOffer = null;

  if (state.round >= CONFIG.season.rounds) {
    finishRegularSeason(state);
  } else {
    state.round += 1;
    state.gameInRound = 0;
    state.phase = 'dashboard';
  }
  touch(state);
}

export function skipReward(state) {
  assertPhase(state, 'reward');
  state.rewardOffer = null;
  if (state.round >= CONFIG.season.rounds) finishRegularSeason(state);
  else {
    state.round += 1;
    state.gameInRound = 0;
    state.phase = 'dashboard';
  }
  touch(state);
}

export function processSeasonEnd(state, { champion = false, reason = 'シーズン終了' } = {}) {
  const legacyResult = champion ? grantChampionshipRewards(state) : { gained: 0, entries: [] };
  const awards = selectAwards(state);
  const retirements = applyAgingAndDevelopment(state);
  const expiredContracts = expireTemporaryPlayers(state);
  state.awards = {
    year: state.year,
    champion,
    reason,
    standings: getLeagueStandings(state).map((team, index) => ({
      rank: index + 1,
      id: team.id,
      name: getTeamDefinition(team.id)?.name ?? team.id,
      wins: team.wins,
      losses: team.losses,
      runDiff: team.runDiff
    })),
    awards,
    retirements: [...retirements, ...expiredContracts],
    legacyResult
  };
  state.phase = 'awards';
  state.postseason = null;
  state.seasonLog.unshift(`${state.year}年は${reason}で終了した。`);
  touch(state);
}

export function advanceToOffseason(state) {
  assertPhase(state, 'awards');
  state.offseason = {
    actionsLeft: getOffseasonActionLimit(state),
    actionCounts: {},
    log: []
  };
  state.phase = 'offseason';
  touch(state);
}

export function performOffseasonAction(state, action, targetPlayerId = null) {
  assertPhase(state, 'offseason');
  if (!state.offseason || state.offseason.actionsLeft <= 0) throw new Error('オフシーズン行動が残っていません。');
  if (!['course', 'scout', 'coach'].includes(action)) throw new Error('不明なオフシーズン行動です。');
  const usedCount = state.offseason.actionCounts[action] ?? 0;
  const efficiency = 1 / (usedCount + 1);
  state.offseason.actionCounts[action] = usedCount + 1;
  state.offseason.actionsLeft -= 1;

  if (action === 'course') {
    const ability = pick(state.rng, MANAGER_ABILITIES);
    state.manager.abilities[ability.id] = Math.min(2, (state.manager.abilities[ability.id] ?? 0) + 1);
    state.offseason.log.unshift(`${ability.name}を習得または強化した。`);
  } else if (action === 'scout') {
    state.modifiers.scoutCandidateBonus += Math.max(1, Math.round(2 * efficiency));
    state.modifiers.scoutAccuracyBonus += Math.max(1, Math.round(2 * efficiency));
    state.offseason.log.unshift('視察で次回ドラフト情報を厚くした。');
  } else if (action === 'coach') {
    const target = state.roster.find((player) => player.id === targetPlayerId) ?? bestYoungPlayer(state);
    improvePlayer(target, Math.max(1, Math.round(5 * efficiency)), state.rng);
    state.offseason.log.unshift(`${target.name}を直接指導した。`);
  }
  touch(state);
}

export function beginNextYearDraft(state) {
  assertPhase(state, 'offseason');
  state.year += 1;
  state.round = 0;
  state.gameInRound = 0;
  state.teams = resetTeamRecords(state);
  state.funds += 85 + getLegacyPerkLevel(state, 'legacy-funds') * 20 - (hasHardCondition(state, 'funds-down') ? 35 : 0);
  resetSeasonPlayerStats(state);
  ensureRosterDepth(state);
  state.awards = null;
  state.offseason = null;
  state.currentMatch = null;
  state.rewardOffer = null;
  state.modifiers.preventDeclineThisSeason = false;
  state.modifiers.nextRewardExtraRecruit = false;
  state.modifiers.extraTrainingSlotsThisSeason = 0;
  state.modifiers.usedTemporaryTrainingSlot = false;
  prepareDraft(state);
  state.seasonLog.unshift(`${state.year}年ドラフト候補が公開された。`);
  touch(state);
}

export function useItem(state, instanceId, targetPlayerId = null) {
  const inventoryIndex = state.inventory.findIndex((entry) => entry.instanceId === instanceId || entry.itemId === instanceId);
  if (inventoryIndex < 0) throw new Error('アイテムを所持していません。');
  const instance = state.inventory[inventoryIndex];
  const item = CONSUMABLE_ITEMS.find((entry) => entry.id === instance.itemId);
  if (!item) throw new Error('不明なアイテムです。');
  if (item.usePhase !== 'any' && item.usePhase !== state.phase) throw new Error('今は使用できません。');

  if (item.id === 'elite-scout-note') {
    state.modifiers.nextDraftElite = true;
  } else if (item.id === 'draft-redraw') {
    state.inventory.splice(inventoryIndex, 1);
    prepareDraft(state);
    state.seasonLog.unshift('ドラフト候補を再抽選した。');
    touch(state);
    return item;
  } else if (item.id === 'decline-freeze') {
    state.modifiers.preventDeclineThisSeason = true;
  } else if (item.id === 'prime-rewind') {
    const player = state.roster.find((entry) => entry.id === targetPlayerId);
    if (!player) throw new Error('対象選手が見つかりません。');
    if (player.rejuvenated) throw new Error('この選手にはすでに使用済みです。');
    player.rejuvenated = true;
    player.age = Math.max(18, player.age - 1);
    improvePlayer(player, 4, state.rng);
  } else if (item.id === 'double-reinforce') {
    state.modifiers.nextRewardExtraRecruit = true;
  } else if (item.id === 'training-lease') {
    if (state.modifiers.usedTemporaryTrainingSlot) throw new Error('今季はすでに臨時練習枠を使っています。');
    state.modifiers.extraTrainingSlotsThisSeason += 1;
    state.modifiers.usedTemporaryTrainingSlot = true;
  }

  state.inventory.splice(inventoryIndex, 1);
  state.seasonLog.unshift(`${item.name}を使用した。`);
  touch(state);
  return item;
}

export function grantChampionshipRewards(state) {
  const hardValue = calculateHardValue(state);
  const entries = [];
  let gained = 0;
  if (hardValue === 0 && !state.manager.legacy.normalCleared) {
    state.manager.legacy.normalCleared = true;
    state.manager.legacy.hardUnlocked = true;
    state.manager.legacy.famePoints += CONFIG.legacy.normalClearPoints;
    gained += CONFIG.legacy.normalClearPoints;
    entries.push(`ノーマル初優勝 +${CONFIG.legacy.normalClearPoints}`);
  }

  if (hardValue > state.manager.legacy.highestHardValue) {
    const newlyCleared = CONFIG.legacy.hardRewards.filter(
      (reward) =>
        reward.value <= hardValue &&
        reward.value > state.manager.legacy.highestHardValue &&
        !state.manager.legacy.claimedHardRewards.includes(reward.value)
    );
    for (const reward of newlyCleared) {
      state.manager.legacy.famePoints += reward.points;
      state.manager.legacy.claimedHardRewards.push(reward.value);
      gained += reward.points;
      entries.push(`ハード${reward.value}突破 +${reward.points}`);
    }
    state.manager.legacy.highestHardValue = hardValue;
  }

  if (gained > 0) {
    state.seasonLog.unshift(`名将ポイントを${gained}獲得した。`);
  }
  return { gained, entries };
}

export function serializeGame(state) {
  return JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2);
}

export function loadGame(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (parsed.schemaVersion !== CONFIG.schemaVersion) {
    throw new Error(`非対応のセーブデータです。schemaVersion=${parsed.schemaVersion}`);
  }
  if (!parsed.rng || typeof parsed.rng.state !== 'number') throw new Error('乱数状態が保存されていません。');
  return parsed;
}

function chooseRegularOpponent(state) {
  const playerLeague = getTeamDefinition(state.teamId).league;
  const opponents = state.teams.filter((team) => team.id !== state.teamId && getTeamDefinition(team.id).league === playerLeague);
  const index = ((state.round - 1) * CONFIG.season.gamesPerRound + state.gameInRound) % opponents.length;
  return opponents[index];
}

function createMatch(state, { kind, opponentId, opponentName, opponentRating }) {
  const lineup = selectLineup(state);
  const pitcher = selectPitcher(state);
  markGameAppearances(lineup, pitcher);
  const match = {
    id: makeId('match', state.rng),
    kind,
    opponentId,
    opponentName,
    opponentRating,
    round: state.round,
    gameInRound: state.gameInRound,
    inning: CONFIG.match.regularInningsBeforeDecision + 1,
    playerScore: 0,
    opponentScore: 0,
    hitterIndex: 0,
    pitcherId: pitcher.id,
    managerPoints: getManagerPoints(state),
    context: null,
    selectedInstruction: null,
    expectedDelta: 0,
    log: []
  };
  const opponent = { id: opponentId, rating: opponentRating };
  for (let inning = 1; inning <= CONFIG.match.regularInningsBeforeDecision; inning += 1) {
    const result = simulateInning(state, lineup, pitcher, opponent, {}, match.hitterIndex);
    match.hitterIndex = result.hitterIndex;
    match.playerScore += result.playerRuns;
    match.opponentScore += result.opponentRuns;
  }
  match.context = createMatchContext(state, match);
  match.log.push(`${CONFIG.match.regularInningsBeforeDecision}回まで自動進行。`);
  return match;
}

function selectLineup(state) {
  const training = getTrainingEffects(state);
  return state.roster
    .filter((player) => player.role === 'hitter')
    .sort((a, b) => hitterScore(b, training) - hitterScore(a, training))
    .slice(0, 9);
}

function selectPitcher(state) {
  const training = getTrainingEffects(state);
  const pitchers = state.roster
    .filter((player) => player.role === 'pitcher')
    .sort((a, b) => pitcherScore(b, training) - pitcherScore(a, training) || a.fatigue - b.fatigue);
  return pitchers[0];
}

function markGameAppearances(lineup, pitcher) {
  for (const player of lineup) player.stats.games += 1;
  pitcher.stats.games += 1;
}

function simulateInning(state, lineup, pitcher, opponent, effects, hitterIndex) {
  const offense = simulatePlayerHalfInning(state, lineup, opponent, effects, hitterIndex);
  const defense = simulateOpponentHalfInning(state, pitcher, opponent, effects);
  return {
    playerRuns: offense.runs,
    opponentRuns: defense.runs,
    hitterIndex: offense.hitterIndex
  };
}

function simulatePlayerHalfInning(state, lineup, opponent, effects, hitterIndex) {
  let outs = 0;
  let runs = 0;
  const bases = [null, null, null];
  while (outs < 3) {
    const batter = lineup[hitterIndex % lineup.length];
    hitterIndex += 1;
    const outcome = rollPlayerBattingOutcome(state, batter, opponent.rating, effects);
    const play = applyBattingOutcome(bases, batter, outcome);
    outs += play.outs;
    runs += play.runs;
  }
  return { runs, hitterIndex };
}

function simulateOpponentHalfInning(state, pitcher, opponent, effects) {
  let outs = 0;
  let runs = 0;
  const bases = [false, false, false];
  while (outs < 3) {
    const outcome = rollOpponentOutcome(state, pitcher, opponent.rating, effects);
    const play = applyOpponentOutcome(bases, outcome);
    outs += play.outs;
    runs += play.runs;
    pitcher.stats.er += play.runs;
  }
  pitcher.stats.outs += 3;
  return { runs };
}

function rollPlayerBattingOutcome(state, batter, opponentRating, effects) {
  const training = getTrainingEffects(state);
  const contact = effectiveAbility(batter, 'contact', training);
  const power = effectiveAbility(batter, 'power', training);
  const eye = effectiveAbility(batter, 'eye', training);
  const strikeoutPenalty = training.strikeout ?? 0;
  const pWalk = clamp(0.072 + (eye - opponentRating) * 0.0011 + (effects.walk ?? 0), 0.025, 0.18);
  const pHr = clamp(0.018 + (power - opponentRating) * 0.0007 + (effects.hr ?? 0), 0.004, 0.085);
  const pHit = clamp(0.185 + (contact - opponentRating) * 0.0013 + (effects.hit ?? 0), 0.11, 0.35);
  const pStrikeout = clamp(0.16 + (opponentRating - contact) * 0.001 + strikeoutPenalty, 0.07, 0.3);
  const roll = randomFloat(state.rng);
  if (roll < pWalk) return 'bb';
  if (roll < pWalk + pHr) return 'hr';
  if (roll < pWalk + pHr + pHit) {
    const extra = randomFloat(state.rng);
    if (extra < clamp(0.09 + (power - 50) * 0.001, 0.05, 0.18)) return 'triple';
    if (extra < clamp(0.28 + (power - 50) * 0.002, 0.18, 0.46)) return 'double';
    return 'single';
  }
  return randomFloat(state.rng) < pStrikeout ? 'so' : 'out';
}

function rollOpponentOutcome(state, pitcher, opponentRating, effects) {
  const training = getTrainingEffects(state);
  const pitchPower = effectiveAbility(pitcher, 'power', training);
  const control = effectiveAbility(pitcher, 'control', training);
  const breaking = effectiveAbility(pitcher, 'breaking', training);
  const pitching = pitchPower * 0.36 + control * 0.32 + breaking * 0.32;
  const hardBoost = hasHardCondition(state, 'npc-plus') ? 5 : 0;
  const pWalk = clamp(0.078 + (opponentRating + hardBoost - control) * 0.001 + (effects.pitcherWalk ?? 0), 0.025, 0.18);
  const pHr = clamp(
    0.019 + (opponentRating + hardBoost - pitchPower) * 0.00065 - (effects.preventHr ?? 0),
    0.003,
    0.085
  );
  const pHit = clamp(
    0.19 + (opponentRating + hardBoost - pitching) * 0.0012 - (effects.preventHit ?? 0),
    0.1,
    0.36
  );
  const pStrikeout = clamp(0.15 + (pitchPower + breaking - opponentRating * 2) * 0.00075, 0.06, 0.32);
  const roll = randomFloat(state.rng);
  if (roll < pWalk) {
    pitcher.stats.bb += 1;
    return 'bb';
  }
  if (roll < pWalk + pHr) {
    pitcher.stats.h += 1;
    return 'hr';
  }
  if (roll < pWalk + pHr + pHit) {
    pitcher.stats.h += 1;
    const extra = randomFloat(state.rng);
    if (extra < 0.08) return 'triple';
    if (extra < 0.3) return 'double';
    return 'single';
  }
  if (randomFloat(state.rng) < pStrikeout) {
    pitcher.stats.so += 1;
    return 'so';
  }
  return 'out';
}

function applyBattingOutcome(bases, batter, outcome) {
  batter.stats.pa += 1;
  if (outcome === 'bb') {
    batter.stats.bb += 1;
    return advanceBases(bases, batter, 0, true);
  }
  if (outcome === 'out' || outcome === 'so') {
    batter.stats.ab += 1;
    if (outcome === 'so') batter.stats.so += 1;
    return { runs: 0, outs: 1 };
  }
  batter.stats.ab += 1;
  batter.stats.h += 1;
  const basesGained = outcome === 'single' ? 1 : outcome === 'double' ? 2 : outcome === 'triple' ? 3 : 4;
  batter.stats.tb += basesGained;
  if (outcome === 'hr') batter.stats.hr += 1;
  const play = advanceBases(bases, batter, basesGained, false);
  batter.stats.rbi += play.runs;
  return play;
}

function advanceBases(bases, batter, basesGained, walk) {
  let runs = 0;
  if (walk) {
    if (bases[0] && bases[1] && bases[2]) {
      bases[2].stats.r += 1;
      runs += 1;
    }
    if (bases[0] && bases[1]) bases[2] = bases[1];
    if (bases[0]) bases[1] = bases[0];
    bases[0] = batter;
    return { runs, outs: 0 };
  }

  for (let index = 2; index >= 0; index -= 1) {
    const runner = bases[index];
    if (!runner) continue;
    bases[index] = null;
    const destination = index + basesGained;
    if (destination >= 3) {
      runner.stats.r += 1;
      runs += 1;
    } else {
      bases[destination] = runner;
    }
  }

  if (basesGained >= 4) {
    batter.stats.r += 1;
    runs += 1;
  } else {
    bases[basesGained - 1] = batter;
  }
  return { runs, outs: 0 };
}

function applyOpponentOutcome(bases, outcome) {
  if (outcome === 'bb') return advanceOpponentBases(bases, 0, true);
  if (outcome === 'out' || outcome === 'so') return { runs: 0, outs: 1 };
  const basesGained = outcome === 'single' ? 1 : outcome === 'double' ? 2 : outcome === 'triple' ? 3 : 4;
  return advanceOpponentBases(bases, basesGained, false);
}

function advanceOpponentBases(bases, basesGained, walk) {
  let runs = 0;
  if (walk) {
    if (bases[0] && bases[1] && bases[2]) runs += 1;
    if (bases[0] && bases[1]) bases[2] = true;
    if (bases[0]) bases[1] = true;
    bases[0] = true;
    return { runs, outs: 0 };
  }
  for (let index = 2; index >= 0; index -= 1) {
    if (!bases[index]) continue;
    bases[index] = false;
    const destination = index + basesGained;
    if (destination >= 3) runs += 1;
    else bases[destination] = true;
  }
  if (basesGained >= 4) runs += 1;
  else bases[basesGained - 1] = true;
  return { runs, outs: 0 };
}

function createMatchContext(state, match) {
  const diff = match.playerScore - match.opponentScore;
  if (diff < 0) {
    return {
      id: 'chase',
      label: '終盤の追い上げ',
      description: `${match.opponentName}を${Math.abs(diff)}点追う展開。攻撃指示の価値が高い。`,
      baseExpectation: -0.25
    };
  }
  if (diff === 0) {
    return {
      id: 'tie',
      label: '終盤の同点',
      description: '一点の重みが大きい。攻守どちらの作戦も勝率に直結する。',
      baseExpectation: 0
    };
  }
  if (diff <= 2) {
    return {
      id: 'protect',
      label: '接戦のリード',
      description: `${diff}点リード。失点期待を下げる判断が効きやすい。`,
      baseExpectation: 0.22
    };
  }
  return {
    id: 'press',
    label: '追加点機',
    description: 'リードをさらに広げ、相手の逆転目を潰したい局面。',
    baseExpectation: 0.35
  };
}

function estimateTacticDelta(context, tactic) {
  const effects = tactic.effects;
  let delta = 0;
  delta += (effects.hit ?? 0) * 7;
  delta += (effects.hr ?? 0) * 11;
  delta += (effects.walk ?? 0) * 4;
  delta += (effects.preventHit ?? 0) * 7;
  delta += (effects.preventHr ?? 0) * 12;
  delta += effects.runPrevention ?? 0;
  if (context.id === 'chase' && tactic.tags.includes('攻撃')) delta += 0.16;
  if (context.id === 'protect' && (tactic.tags.includes('守備') || tactic.tags.includes('投手'))) delta += 0.16;
  if (context.id === 'tie' && tactic.tags.includes('接戦')) delta += 0.12;
  return Math.round(delta * 100) / 100;
}

function applyPostGameFatigue(state, effects) {
  const fatigueHard = hasHardCondition(state, 'fatigue-up') ? 1 : 0;
  for (const player of state.roster) {
    const durability = player.abilities.durability ?? 55;
    const baseFatigue = player.role === 'pitcher' ? 2 : 1;
    const tacticFatigue =
      player.role === 'pitcher' ? effects.fatiguePitchers ?? 0 : effects.fatigueHitters ?? 0;
    player.fatigue = clamp(player.fatigue + baseFatigue + fatigueHard + tacticFatigue - Math.floor(durability / 45), 0, 80);
    player.condition = clamp(player.condition + randomInt(state.rng, -1, 1), -10, 10);
  }
}

function awardGameExperience(state, playerWon) {
  const training = getTrainingEffects(state);
  for (const player of state.roster) {
    const youth = player.age <= 24 ? 1 + (training.youthGrowth ?? 0) + (state.manager.abilities['farm-system'] ?? 0) * 0.12 : 1;
    const activeBonus = player.stats.games > 0 ? 1 : 0.35;
    player.xp += Math.round((playerWon ? 3 : 2) * youth * activeBonus);
  }
}

function recordMatchHistory(state, match, playerWon) {
  state.matchHistory.unshift({
    id: match.id,
    year: state.year,
    round: match.round,
    kind: match.kind,
    opponentName: match.opponentName,
    playerScore: match.playerScore,
    opponentScore: match.opponentScore,
    playerWon,
    instruction: match.selectedInstruction,
    expectedDelta: match.expectedDelta
  });
  state.matchHistory = state.matchHistory.slice(0, 30);
}

function finishRegularGame(state, match, playerWon) {
  updateStanding(state, state.teamId, playerWon, match.playerScore, match.opponentScore);
  updateStanding(state, match.opponentId, !playerWon, match.opponentScore, match.playerScore);
  simulateNpcGames(state);
  state.gameInRound += 1;
  state.seasonLog.unshift(`${match.opponentName}戦は${match.playerScore}-${match.opponentScore}で${playerWon ? '勝利' : '敗戦'}。`);
  if (state.gameInRound >= CONFIG.season.gamesPerRound) {
    const tier = state.round === CONFIG.season.rounds ? 'final' : state.round === 3 || state.round === 6 ? 'strong' : 'light';
    state.rewardOffer = createRewardOffer(state, tier);
    state.phase = 'reward';
  } else {
    state.phase = 'dashboard';
  }
}

function updateStanding(state, teamId, won, runsFor, runsAgainst) {
  const team = state.teams.find((entry) => entry.id === teamId);
  if (!team) return;
  if (won) team.wins += 1;
  else team.losses += 1;
  team.runsFor += runsFor;
  team.runsAgainst += runsAgainst;
  team.runDiff = team.runsFor - team.runsAgainst;
}

function simulateNpcGames(state) {
  for (const league of ['east', 'west']) {
    const teams = shuffle(
      state.rng,
      state.teams.filter((team) => getTeamDefinition(team.id).league === league && team.id !== state.teamId)
    );
    for (let index = 0; index + 1 < teams.length; index += 2) {
      const home = teams[index];
      const away = teams[index + 1];
      const homeWinChance = clamp(0.5 + (home.rating - away.rating) * 0.012, 0.25, 0.75);
      const homeWon = chance(state.rng, homeWinChance);
      const homeRuns = randomInt(state.rng, 1, 7) + (homeWon ? 1 : 0);
      const awayRuns = randomInt(state.rng, 1, 7) + (homeWon ? 0 : 1);
      updateStanding(state, home.id, homeWon, homeRuns, awayRuns);
      updateStanding(state, away.id, !homeWon, awayRuns, homeRuns);
    }
  }
}

function finishRegularSeason(state) {
  const rank = getPlayerRank(state);
  const cutoff = hasHardCondition(state, 'rank-demand') ? 2 : CONFIG.season.playoffRankCutoff;
  if (rank <= cutoff) {
    const opponent = chooseCsOpponent(state);
    state.postseason = {
      stage: 'cs',
      playerWins: 0,
      opponentWins: 0,
      opponentId: opponent.id,
      log: [`リーグ${rank}位でCSへ進出した。`]
    };
    state.phase = 'postseason';
  } else {
    processSeasonEnd(state, { champion: false, reason: `リーグ${rank}位でCS進出ならず` });
  }
}

function chooseCsOpponent(state) {
  const standings = getLeagueStandings(state).filter((team) => team.id !== state.teamId);
  return standings[0] ?? state.teams.find((team) => team.id !== state.teamId);
}

function chooseJapanSeriesOpponent(state) {
  const playerLeague = getTeamDefinition(state.teamId).league;
  const otherLeague = playerLeague === 'east' ? 'west' : 'east';
  return getLeagueStandings(state, otherLeague)[0] ?? state.teams.find((team) => team.id !== state.teamId);
}

function createRewardOption(state, tier) {
  const rarity = rollRewardRarity(state.rng, tier);
  const typeWeights =
    tier === 'light'
      ? [
          { value: 'funds', weight: 32 },
          { value: 'materials', weight: 24 },
          { value: 'xp', weight: 18 },
          { value: 'item', weight: 16 },
          { value: 'equipment', weight: 10 }
        ]
      : [
          { value: 'equipment', weight: 36 },
          { value: 'item', weight: 26 },
          { value: 'veteran', weight: 20 },
          { value: 'funds', weight: 10 },
          { value: 'xp', weight: 8 }
        ];
  const type = weightedPick(state.rng, typeWeights);
  const scale = rarity === 'masterwork' ? 1.7 : rarity === 'quality' ? 1.28 : 1;

  if (type === 'funds') {
    const amount = Math.round((tier === 'light' ? 24 : 50) * scale);
    return rewardOption(state, 'funds', rarity, `球団資金 +${amount}`, '補強や強報酬の対価に使える。', { amount });
  }
  if (type === 'materials') {
    const amount = Math.round((tier === 'light' ? 3 : 7) * scale);
    return rewardOption(state, 'materials', rarity, `強化素材 +${amount}`, '作戦や練習の将来強化に使う素材。', { amount });
  }
  if (type === 'xp') {
    const amount = Math.round((tier === 'light' ? 10 : 22) * scale);
    return rewardOption(state, 'xp', rarity, `全体経験値 +${amount}`, '在籍選手へ少量ずつ経験値を配る。', { amount });
  }
  if (type === 'item') {
    const item = pickRewardItem(state, rarity);
    return rewardOption(state, 'item', rarity, item.name, item.summary, { itemId: item.id });
  }
  if (type === 'veteran') {
    const role = chance(state.rng, 0.45) ? 'pitcher' : 'hitter';
    const player = generatePlayer(state.rng, role, randomInt(state.rng, 31, 36), false);
    player.contractUntilYear = state.year;
    player.condition = 5;
    return rewardOption(state, 'veteran', rarity, `期限付き補強 ${player.name}`, `${player.position}の即戦力。今季終了まで在籍。`, { player });
  }

  const equipment = pickRewardEquipment(state, rarity);
  return rewardOption(state, equipment.kind, rarity, equipment.item.name, equipment.item.summary, {
    id: equipment.item.id
  });
}

function rewardOption(state, type, rarity, label, description, payload) {
  return {
    id: makeId(type, state.rng),
    type,
    rarity,
    label,
    description,
    payload
  };
}

function pickRewardItem(state, rarity) {
  const unlocked = CONSUMABLE_ITEMS.filter((item) => state.unlocked.items.includes(item.id));
  const masterworkAllowed = rarity === 'masterwork' || getLegacyPerkLevel(state, 'legacy-item-unlock') > 0;
  const candidates = masterworkAllowed ? unlocked : unlocked.filter((item) => item.rarity !== 'masterwork');
  return pick(state.rng, candidates.length ? candidates : unlocked);
}

function pickRewardEquipment(state, rarity) {
  const tacticCandidates = TACTICS.filter((item) => !state.unlocked.tactics.includes(item.id));
  const trainingCandidates = TRAINING_PLANS.filter((item) => !state.unlocked.training.includes(item.id));
  const all = [
    ...tacticCandidates.map((item) => ({ kind: 'tactic', item })),
    ...trainingCandidates.map((item) => ({ kind: 'training', item }))
  ];
  if (!all.length) {
    const item = pick(state.rng, TACTICS);
    return { kind: 'materials', item: { ...item, name: '装備研究素材', summary: '未解放装備がないため素材に変換される。' } };
  }
  const filtered = all.filter((entry) => rarity === 'masterwork' || entry.item.rarity !== 'masterwork');
  return pick(state.rng, filtered.length ? filtered : all);
}

function applyReward(state, reward) {
  if (reward.type === 'funds') {
    state.funds += reward.payload.amount;
  } else if (reward.type === 'materials') {
    state.materials += reward.payload.amount ?? 5;
  } else if (reward.type === 'xp') {
    for (const player of state.roster) player.xp += Math.ceil(reward.payload.amount / Math.max(1, state.roster.length));
  } else if (reward.type === 'item') {
    addItemToInventory(state, reward.payload.itemId);
  } else if (reward.type === 'veteran') {
    state.roster.push(reward.payload.player);
    if (state.modifiers.nextRewardExtraRecruit) {
      const extra = generatePlayer(state.rng, chance(state.rng, 0.45) ? 'pitcher' : 'hitter', randomInt(state.rng, 30, 35), false);
      extra.contractUntilYear = state.year;
      state.roster.push(extra);
      state.modifiers.nextRewardExtraRecruit = false;
    }
  } else if (reward.type === 'tactic') {
    if (!state.unlocked.tactics.includes(reward.payload.id)) state.unlocked.tactics.push(reward.payload.id);
    else state.materials += 5;
  } else if (reward.type === 'training') {
    if (!state.unlocked.training.includes(reward.payload.id)) state.unlocked.training.push(reward.payload.id);
    else state.materials += 5;
  }
  state.seasonLog.unshift(`報酬「${reward.label}」を獲得した。`);
}

function addItemToInventory(state, itemId) {
  const slots = CONFIG.inventory.itemSlots;
  if (state.inventory.length >= slots) {
    state.funds += 18;
    state.seasonLog.unshift('所持枠超過のためアイテムを資金に変換した。');
    return;
  }
  state.inventory.push({ instanceId: makeId('item', state.rng), itemId });
}

function selectAwards(state) {
  const hitters = state.roster.filter((player) => player.role === 'hitter');
  const pitchers = state.roster.filter((player) => player.role === 'pitcher');
  const bestHitter = hitters
    .map((player) => ({ player, rates: battingRates(player.stats) }))
    .sort((a, b) => b.rates.ops - a.rates.ops)[0];
  const bestPitcher = pitchers
    .map((player) => ({ player, rates: pitchingRates(player.stats) }))
    .filter((entry) => entry.rates.innings > 0)
    .sort((a, b) => a.rates.era - b.rates.era)[0];
  const rookie = state.roster
    .filter((player) => player.joinedYear === state.year)
    .sort((a, b) => playerOverall(b) - playerOverall(a))[0];
  return [
    bestHitter
      ? { title: '年間打撃賞', playerId: bestHitter.player.id, playerName: bestHitter.player.name, note: `OPS ${bestHitter.rates.ops.toFixed(3)}` }
      : null,
    bestPitcher
      ? { title: '年間投手賞', playerId: bestPitcher.player.id, playerName: bestPitcher.player.name, note: `ERA ${bestPitcher.rates.era.toFixed(2)}` }
      : null,
    rookie ? { title: '新人期待株', playerId: rookie.id, playerName: rookie.name, note: `${rookie.position} / 総合${playerOverall(rookie)}` } : null
  ].filter(Boolean);
}

function applyAgingAndDevelopment(state) {
  const training = getTrainingEffects(state);
  const retirements = [];
  for (const player of state.roster) {
    player.history.push({
      year: state.year,
      age: player.age,
      position: player.position,
      overall: playerOverall(player),
      stats: cloneStats(player.stats)
    });
    const previousAge = player.age;
    player.age += 1;
    const growth = calculateGrowthAmount(state, player, training, previousAge);
    if (growth > 0) improvePlayer(player, growth, state.rng);
    const decline = calculateDeclineAmount(state, player, training, previousAge);
    if (decline > 0) declinePlayer(player, decline, state.rng);
  }

  state.roster = state.roster.filter((player) => {
    const retiring =
      player.age >= CONFIG.roster.forcedRetireAge ||
      (player.age >= CONFIG.roster.retireAgeFloor && playerOverall(player) < 42 && chance(state.rng, 0.28 + (player.age - 36) * 0.05));
    if (retiring) {
      retirements.push({ playerId: player.id, playerName: player.name, reason: `${player.age}歳で引退` });
    }
    return !retiring;
  });
  return retirements;
}

function calculateGrowthAmount(state, player, training, ageBeforeBirthday) {
  const peak = growthPeak(player.growthType);
  if (ageBeforeBirthday > peak) return 0;
  const ageFactor = ageBeforeBirthday <= 24 ? 1.15 : 0.7;
  const youthTraining = ageBeforeBirthday <= 24 ? 1 + (training.youthGrowth ?? 0) : 1;
  const manager = 1 + (state.manager.abilities['farm-system'] ?? 0) * 0.15;
  const potentialGap = Math.max(0, player.potential - playerOverall(player));
  return Math.min(5, Math.round((1 + player.xp / 40 + potentialGap / 35) * ageFactor * youthTraining * manager));
}

function calculateDeclineAmount(state, player, training, ageBeforeBirthday) {
  if (state.modifiers.preventDeclineThisSeason) return 0;
  const peak = growthPeak(player.growthType);
  if (ageBeforeBirthday <= peak + 2) return 0;
  const veteranPlan = training.veteranDecline ?? 0;
  const care = (state.manager.abilities['care-room'] ?? 0) * 0.12;
  const base = 1 + Math.max(0, ageBeforeBirthday - peak - 3) * 0.35;
  return Math.max(0, Math.round(base * (1 + veteranPlan - care)));
}

function growthPeak(growthType) {
  if (growthType === 'early') return 25;
  if (growthType === 'late') return 30;
  if (growthType === 'steady') return 29;
  return 27;
}

function improvePlayer(player, amount, rng) {
  const keys = Object.keys(player.abilities);
  for (let count = 0; count < amount; count += 1) {
    const key = pick(rng, keys);
    player.abilities[key] = clamp(player.abilities[key] + 1, 1, 100);
  }
  player.xp = Math.max(0, player.xp - amount * 5);
}

function declinePlayer(player, amount, rng) {
  const keys = Object.keys(player.abilities).filter((key) => key !== 'durability');
  for (let count = 0; count < amount; count += 1) {
    const key = pick(rng, keys);
    player.abilities[key] = clamp(player.abilities[key] - 1, 1, 100);
  }
}

function expireTemporaryPlayers(state) {
  const expired = [];
  state.roster = state.roster.filter((player) => {
    const leaving = player.contractUntilYear && player.contractUntilYear <= state.year;
    if (leaving) expired.push({ playerId: player.id, playerName: player.name, reason: '期限付き補強の契約満了' });
    return !leaving;
  });
  return expired;
}

function resetSeasonPlayerStats(state) {
  for (const player of state.roster) {
    player.stats = createStats(player.role);
    player.fatigue = Math.max(0, Math.floor(player.fatigue / 3));
    player.condition = clamp(player.condition + randomInt(state.rng, -2, 3), -8, 8);
  }
}

function resetTeamRecords(state) {
  return state.teams.map((team) => {
    const definition = getTeamDefinition(team.id);
    const hardBoost = team.id === state.teamId ? 0 : hasHardCondition(state, 'npc-plus') ? 5 : 0;
    return {
      id: team.id,
      wins: 0,
      losses: 0,
      runsFor: 0,
      runsAgainst: 0,
      runDiff: 0,
      rating: definition.baseRating + randomInt(state.rng, -3, 3) + hardBoost
    };
  });
}

function ensureRosterDepth(state) {
  const hitters = state.roster.filter((player) => player.role === 'hitter').length;
  const pitchers = state.roster.filter((player) => player.role === 'pitcher').length;
  for (let count = hitters; count < CONFIG.roster.minimumHitters; count += 1) {
    state.roster.push(generatePlayer(state.rng, 'hitter', randomInt(state.rng, 24, 31), false));
  }
  for (let count = pitchers; count < CONFIG.roster.minimumPitchers; count += 1) {
    state.roster.push(generatePlayer(state.rng, 'pitcher', randomInt(state.rng, 24, 31), false));
  }
}

function bestYoungPlayer(state) {
  return [...state.roster].sort((a, b) => {
    const ageScore = a.age - b.age;
    if (ageScore !== 0) return ageScore;
    return playerOverall(b) - playerOverall(a);
  })[0];
}
