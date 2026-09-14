import { describe, expect, it } from 'vitest';
import { CONFIG } from './config.js';
import { HARD_CONDITIONS, TACTICS, TRAINING_PLANS } from './data.js';
import {
  advanceToOffseason,
  applyMatchInstruction,
  beginNextYearDraft,
  claimReward,
  createNewGame,
  draftPlayer,
  equipTactic,
  equipTraining,
  getPlayerTeam,
  grantChampionshipRewards,
  loadGame,
  processSeasonEnd,
  recordPostseasonResult,
  selectRewardRarity,
  serializeGame,
  skipDraft,
  startNextGame,
  startSeasonAfterDraft,
  useItem,
  performOffseasonAction
} from './engine.js';
import { randomFloat } from './rng.js';

describe('監督ハクスラ core loop', () => {
  it('ドラフト獲得上限を超えられない', () => {
    const state = createNewGame({ seed: 'draft-limit' });
    for (let index = 0; index < CONFIG.draft.maxPlayerPicks; index += 1) {
      draftPlayer(state, state.draft.pool[0].id);
    }
    expect(state.draft.picks).toHaveLength(CONFIG.draft.maxPlayerPicks);
    state.phase = 'draft';
    expect(() => draftPlayer(state, state.draft.pool[0].id)).toThrow('ドラフト獲得上限');
  });

  it('AI指名で候補がリストから消える', () => {
    const state = createNewGame({ seed: 'ai-draft' });
    const beforeCount = state.draft.pool.length;
    const pickedId = state.draft.pool[0].id;
    draftPlayer(state, pickedId);
    expect(state.draft.pool).toHaveLength(beforeCount - 2);
    expect(state.draft.pool.some((candidate) => candidate.id === pickedId)).toBe(false);
    expect(state.draft.aiLog).toHaveLength(1);
  });

  it('8ラウンド終了後に順位に応じてポストシーズンへ進む', () => {
    const state = createNewGame({ seed: 'regular-to-postseason' });
    skipDraft(state);
    startSeasonAfterDraft(state);

    while (state.phase !== 'postseason' && state.phase !== 'awards') {
      if (state.phase === 'dashboard') {
        startNextGame(state);
        applyMatchInstruction(state, 'hold');
      }
      if (state.phase === 'reward') {
        getPlayerTeam(state).wins += 5;
        claimReward(state, state.rewardOffer.options[0].id);
      }
    }

    expect(state.round).toBe(CONFIG.season.rounds);
    expect(state.phase).toBe('postseason');
  });

  it('日本シリーズは4勝先取で決着する', () => {
    const state = createNewGame({ seed: 'japan-series' });
    state.phase = 'postseason';
    state.postseason = {
      stage: 'japanSeries',
      playerWins: 3,
      opponentWins: 1,
      opponentId: state.teams.find((team) => team.id !== state.teamId).id,
      log: []
    };
    recordPostseasonResult(state, true, { playerScore: 5, opponentScore: 2 });
    expect(state.phase).toBe('awards');
    expect(state.awards.champion).toBe(true);
  });

  it('年齢増加、成長、衰え、引退を処理する', () => {
    const state = createNewGame({ seed: 'aging' });
    const young = state.roster[0];
    const old = state.roster[1];
    young.age = 22;
    young.xp = 80;
    old.age = 41;
    processSeasonEnd(state, { champion: false, reason: '検証' });
    expect(young.age).toBe(23);
    expect(young.history).toHaveLength(1);
    expect(state.roster.some((player) => player.id === old.id)).toBe(false);
  });

  it('作戦と練習の装備枠を守る', () => {
    const state = createNewGame({ seed: 'equipment' });
    state.unlocked.tactics = TACTICS.map((item) => item.id);
    state.unlocked.training = TRAINING_PLANS.map((item) => item.id);
    state.equipment.tactics = [];
    state.equipment.training = [];
    for (const tactic of TACTICS.slice(0, CONFIG.equipment.tacticSlots)) equipTactic(state, tactic.id);
    expect(() => equipTactic(state, TACTICS[CONFIG.equipment.tacticSlots].id)).toThrow('作戦装備枠');
    for (const training of TRAINING_PLANS.slice(0, CONFIG.equipment.trainingSlots)) equipTraining(state, training.id);
    expect(() => equipTraining(state, TRAINING_PLANS[CONFIG.equipment.trainingSlots].id)).toThrow('練習方針装備枠');
  });

  it('報酬レアリティを重みに沿って選ぶ', () => {
    expect(selectRewardRarity(0, 'light')).toBe('normal');
    expect(selectRewardRarity(0.99, 'light')).toBe('masterwork');
    expect(selectRewardRarity(0.25, 'strong')).toBe('quality');
  });

  it('消費アイテムの使用制限を守る', () => {
    const state = createNewGame({ seed: 'item-limit' });
    const player = state.roster[0];
    player.age = 35;
    state.inventory.push({ instanceId: 'item-a', itemId: 'prime-rewind' });
    state.inventory.push({ instanceId: 'item-b', itemId: 'prime-rewind' });
    useItem(state, 'item-a', player.id);
    expect(player.rejuvenated).toBe(true);
    expect(() => useItem(state, 'item-b', player.id)).toThrow('使用済み');
  });

  it('オフシーズン行動回数を制限する', () => {
    const state = createNewGame({ seed: 'offseason' });
    processSeasonEnd(state, { champion: false, reason: '検証' });
    advanceToOffseason(state);
    performOffseasonAction(state, 'scout');
    performOffseasonAction(state, 'scout');
    performOffseasonAction(state, 'course');
    expect(state.offseason.actionsLeft).toBe(0);
    expect(() => performOffseasonAction(state, 'coach', state.roster[0].id)).toThrow('残っていません');
  });

  it('ノーマル初クリアで名将ポイントとハード条件を解放する', () => {
    const state = createNewGame({ seed: 'normal-clear' });
    const result = grantChampionshipRewards(state);
    expect(result.gained).toBe(CONFIG.legacy.normalClearPoints);
    expect(state.manager.legacy.hardUnlocked).toBe(true);
    expect(state.manager.legacy.normalCleared).toBe(true);
  });

  it('最高ハード値更新時に未獲得報酬を一括付与する', () => {
    const state = createNewGame({ seed: 'hard-bulk' });
    state.manager.legacy.normalCleared = true;
    state.manager.legacy.hardUnlocked = true;
    state.manager.hardConditions = HARD_CONDITIONS.slice(0, 2).map((condition) => condition.id);
    const result = grantChampionshipRewards(state);
    expect(result.entries).toEqual(['ハード3突破 +1']);
    state.manager.hardConditions = HARD_CONDITIONS.slice(0, 3).map((condition) => condition.id);
    const second = grantChampionshipRewards(state);
    expect(second.entries).toEqual(['ハード6突破 +1']);
    expect(state.manager.legacy.highestHardValue).toBeGreaterThanOrEqual(6);
  });

  it('同じハード値の再クリアで名将ポイントを重複付与しない', () => {
    const state = createNewGame({ seed: 'hard-duplicate' });
    state.manager.legacy.normalCleared = true;
    state.manager.legacy.hardUnlocked = true;
    state.manager.hardConditions = HARD_CONDITIONS.slice(0, 3).map((condition) => condition.id);
    const first = grantChampionshipRewards(state);
    const points = state.manager.legacy.famePoints;
    const second = grantChampionshipRewards(state);
    expect(first.gained).toBeGreaterThan(0);
    expect(second.gained).toBe(0);
    expect(state.manager.legacy.famePoints).toBe(points);
  });

  it('セーブ、読み込み、乱数状態の再現性を保つ', () => {
    const state = createNewGame({ seed: 'save-rng' });
    const saved = serializeGame(state);
    const nextA = randomFloat(state.rng);
    const loaded = loadGame(saved);
    const nextB = randomFloat(loaded.rng);
    expect(nextB).toBe(nextA);
  });

  it('次年度ドラフトへ進行できる', () => {
    const state = createNewGame({ seed: 'next-year' });
    processSeasonEnd(state, { champion: false, reason: '検証' });
    advanceToOffseason(state);
    beginNextYearDraft(state);
    expect(state.year).toBe(2);
    expect(state.phase).toBe('draft');
    expect(state.draft.year).toBe(2);
  });
});
