import { useEffect, useMemo, useState } from 'react';
import { CONFIG } from './game/config.js';
import {
  CONSUMABLE_ITEMS,
  HARD_CONDITIONS,
  LEGACY_PERKS,
  TACTICS,
  TEAMS,
  TRAINING_PLANS
} from './game/data.js';
import {
  advanceToOffseason,
  applyMatchInstruction,
  confirmMatchResult,
  continueMatch,
  beginNextYearDraft,
  calculateHardValue,
  claimReward,
  createNewGame,
  draftPlayer,
  equipTactic,
  equipTraining,
  getAvailableFamePoints,
  getInstructionOptions,
  getAbilityEntries,
  getLeagueStandings,
  getPhaseLabel,
  getPlayerRank,
  getPlayerTeam,
  getRosterPlan,
  getTacticSlots,
  getTrainingSlots,
  moveLineupSlot,
  playerOverall,
  purchaseLegacyPerk,
  resetLegacyPerks,
  skipDraft,
  skipCurrentMatch,
  skipNextGame,
  skipNextPostseasonGame,
  skipReward,
  startNextGame,
  startPostseasonGame,
  startSeasonAfterDraft,
  teamPower,
  toggleHardCondition,
  unequipTactic,
  unequipTraining,
  updateLineupSlot,
  updatePitchingPlan,
  abilityLabelForPlayer,
  useItem,
  performOffseasonAction
} from './game/engine.js';
import { battingRates, formatAverage, formatFixed, pitchingRates } from './game/stats.js';
import { clearSavedGame, exportGame, importGame, loadSavedGame, saveGame } from './game/storage';

type GameState = any;
type Player = any;

const phaseTabs = [
  { id: 'phase', label: '進行中' },
  { id: 'team', label: '編成' },
  { id: 'equipment', label: '装備' },
  { id: 'legacy', label: '名将' },
  { id: 'settings', label: '設定' }
];

function App() {
  const [game, setGame] = useState<GameState | null>(() => {
    try {
      return loadSavedGame();
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('phase');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  const commit = (mutator: (state: GameState) => void, success = '進行しました。') => {
    if (!game) return;
    const next = cloneGame(game);
    try {
      mutator(next);
      setGame(next);
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作に失敗しました。');
    }
  };

  const startGame = (managerName: string, teamId: string, seed: string) => {
    const next = createNewGame({ managerName, teamId, seed: seed || undefined });
    setGame(next);
    setActiveTab('dashboard');
    setMessage('新しい監督生活を開始しました。');
  };

  const resetGame = () => {
    clearSavedGame();
    setGame(null);
    setMessage('セーブを削除しました。');
  };

  if (!game) {
    return <TitleScreen onStart={startGame} message={message} />;
  }

  const focusedPhase = activeTab === 'phase'
    ? (['draft', 'equipment', 'match', 'reward', 'postseason', 'awards', 'offseason'].includes(game.phase) ? game.phase : 'dashboard')
    : activeTab;

  return (
    <div className="app-shell">
      <header className="topbar">
        <TeamBadge teamId={game.teamId} />
        <div>
          <p className="eyebrow">{game.manager.name}</p>
          <h1>監督ハクスラ</h1>
        </div>
        <button className="ghost-button small-button" onClick={() => setActiveTab('settings')} aria-label="設定を開く">
          設定
        </button>
      </header>

      <StatusStrip game={game} />

      {message && <p className="toast" role="status">{message}</p>}

      <main className="main-surface">
        {focusedPhase === 'draft' && <DraftView game={game} commit={commit} />}
        {focusedPhase === 'match' && <MatchView game={game} commit={commit} />}
        {focusedPhase === 'reward' && <RewardView game={game} commit={commit} />}
        {focusedPhase === 'postseason' && <PostseasonView game={game} commit={commit} />}
        {focusedPhase === 'awards' && <AwardsView game={game} commit={commit} />}
        {focusedPhase === 'offseason' && <OffseasonView game={game} commit={commit} />}
        {focusedPhase === 'dashboard' && <DashboardView game={game} commit={commit} />}
        {focusedPhase === 'team' && <TeamView game={game} commit={commit} />}
        {focusedPhase === 'equipment' && <EquipmentView game={game} commit={commit} />}
        {focusedPhase === 'legacy' && <LegacyView game={game} commit={commit} />}
        {focusedPhase === 'settings' && <SettingsView game={game} setGame={setGame} resetGame={resetGame} setMessage={setMessage} />}
      </main>

      <nav className="bottom-tabs" aria-label="主要画面">
        {phaseTabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => {
              setActiveTab(tab.id);
              setMessage('');
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TitleScreen({ onStart, message }: { onStart: (managerName: string, teamId: string, seed: string) => void; message: string }) {
  const [managerName, setManagerName] = useState('新米監督');
  const [teamId, setTeamId] = useState(TEAMS[0].id);
  const [seed, setSeed] = useState('');
  return (
    <main className="title-screen">
      <section className="title-panel">
        <div className="logo-lockup">
          <TeamBadge teamId={teamId} large />
          <div>
            <p className="eyebrow">一年完走MVP</p>
            <h1>監督ハクスラ</h1>
          </div>
        </div>
        <label>
          監督名
          <input value={managerName} onChange={(event) => setManagerName(event.target.value)} />
        </label>
        <label>
          就任球団
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            {TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          シード
          <input value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="空欄で自動" />
        </label>
        <button className="primary-button" onClick={() => onStart(managerName, teamId, seed)}>
          ドラフトから開始
        </button>
        {message && <p className="toast">{message}</p>}
      </section>
    </main>
  );
}

function StatusStrip({ game }: { game: GameState }) {
  const playerTeam = getPlayerTeam(game);
  return (
    <section className="status-strip" aria-label="現在状況">
      <Metric label="年" value={`${game.year}年`} />
      <Metric label="フェーズ" value={getPhaseLabel(game)} />
      <Metric label="ラウンド" value={game.round > 0 ? `${game.round}/${CONFIG.season.rounds}` : '準備'} />
      <Metric label="成績" value={`${playerTeam?.wins ?? 0}勝${playerTeam?.losses ?? 0}敗`} />
      <Metric label="資金" value={`${game.funds}`} />
      <Metric label="名将" value={`${game.manager.legacy.famePoints}`} />
    </section>
  );
}

function DashboardView({ game, commit }: ViewProps) {
  const power = teamPower(game);
  const standings = getLeagueStandings(game);
  const nextGameText = `${game.round}R ${game.gameInRound + 1}/${CONFIG.season.gamesPerRound}`;
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">年間進行</p>
          <h2>{nextGameText}</h2>
          <p>リーグ{getPlayerRank(game)}位。総合力 {power.overall.toFixed(1)} / 攻撃 {power.offense.toFixed(1)} / 投手 {power.pitching.toFixed(1)}</p>
        </div>
        <div className="action-buttons">
          <button className="primary-button" onClick={() => commit(startNextGame, '試合を開始しました。')}>
            次の試合へ
          </button>
          <button className="secondary-button" onClick={() => commit(skipNextGame, 'この試合を自動進行しました。結果を確認してください。')}>
            この試合をスキップ
          </button>
        </div>
      </div>

      <section className="panel">
        <h2>順位表</h2>
        <div className="standings-list">
          {standings.map((team: any, index: number) => (
            <div className={team.id === game.teamId ? 'standing-row self' : 'standing-row'} key={team.id}>
              <span>{index + 1}</span>
              <TeamBadge teamId={team.id} compact />
              <strong>{teamName(team.id)}</strong>
              <span>{team.wins}勝{team.losses}敗</span>
              <span>{team.runDiff >= 0 ? '+' : ''}{team.runDiff}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>最近の記録</h2>
        <LogList entries={game.matchHistory.slice(0, 5).map((match: any) => `${match.opponentName} ${match.playerScore}-${match.opponentScore} ${match.draw ? '分' : match.playerWon ? '勝' : '敗'} / ${match.instruction}`)} />
      </section>
    </section>
  );
}

function DraftView({ game, commit }: ViewProps) {
  const draft = game.draft;
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">{game.year}年ドラフト</p>
          <h2>{draft.picks.length}/{draft.maxPicks}人指名</h2>
          <p>現在能力は概ね正確、潜在能力と故障傾向はスカウト精度で範囲表示です。</p>
        </div>
        <button className="secondary-button" onClick={() => commit(skipDraft, 'ドラフトを終了しました。')}>
          指名を終える
        </button>
      </div>

      <div className="candidate-grid">
        {draft.pool.map((candidate: any) => (
          <article className="card candidate-card" key={candidate.id}>
            <div className="card-head">
              <div>
                <p className="eyebrow">{candidate.position} / {candidate.batsThrows}</p>
                <h3>{candidate.name}</h3>
              </div>
              <span className="rarity-pill">{candidate.age}歳</span>
            </div>
            <div className="mini-metrics">
              <Metric label="現在" value={`${candidate.currentOverall}`} />
              <Metric label="潜在" value={`${candidate.potentialRange[0]}〜${candidate.potentialRange[1]}`} />
              <Metric label="故障" value={candidate.injuryRange} />
            </div>
            <p>{candidate.scoutReport}</p>
            <div className="ability-grid compact-grid">
              {getAbilityEntries(candidate).map(({ key, label }: any) => {
                const range = candidate.abilityRanges?.[key];
                if (!range) return null;
                return (
                <div key={key}>
                  <span>{label}</span>
                  <meter min={0} max={100} value={(range[0] + range[1]) / 2} />
                  <strong>{range[0]}〜{range[1]}</strong>
                </div>
                );
              })}
            </div>
            <p className="small-note">現在能力は推定範囲、潜在は別評価です。評価確度は視察で向上します。</p>
            <p className="tags">{candidate.traits.join(' / ')}</p>
            <button className="primary-button" onClick={() => commit((next) => draftPlayer(next, candidate.id), `${candidate.name}を指名しました。`)}>
              指名
            </button>
          </article>
        ))}
      </div>

      <section className="panel">
        <h2>AI指名</h2>
        <LogList entries={draft.aiLog.slice(0, 6).map((entry: any) => `${entry.teamName}: ${entry.candidateName} ${entry.position}`)} />
      </section>
    </section>
  );
}

function EquipmentView({ game, commit }: ViewProps) {
  const tacticSlots = getTacticSlots(game);
  const trainingSlots = getTrainingSlots(game);
  const readOnly = game.phase === 'match';
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">作戦と練習</p>
          <h2>装備枠 {game.equipment.tactics.length}/{tacticSlots} ・ {game.equipment.training.length}/{trainingSlots}</h2>
          <p>{readOnly ? '試合中は閲覧のみです。装備変更は試合間に反映されます。' : '作戦は試合中のアクティブ、練習はシーズン中のパッシブです。'}</p>
        </div>
        {['draft', 'equipment'].includes(game.phase) && (
          <button className="primary-button" onClick={() => commit(startSeasonAfterDraft, 'シーズンが開幕しました。')}>
            シーズン開始
          </button>
        )}
      </div>

      <EquipmentList
        title="作戦"
        items={TACTICS}
        selected={game.equipment.tactics}
        unlocked={game.unlocked.tactics}
        slots={tacticSlots}
        readOnly={readOnly}
        onToggle={(id: string, active: boolean) => commit((next) => (active ? unequipTactic(next, id) : equipTactic(next, id)), active ? '作戦を外しました。' : '作戦を装備しました。')}
      />
      <EquipmentList
        title="練習方針"
        items={TRAINING_PLANS}
        selected={game.equipment.training}
        unlocked={game.unlocked.training}
        slots={trainingSlots}
        readOnly={readOnly}
        onToggle={(id: string, active: boolean) => commit((next) => (active ? unequipTraining(next, id) : equipTraining(next, id)), active ? '練習方針を外しました。' : '練習方針を装備しました。')}
      />
    </section>
  );
}

function EquipmentList({ title, items, selected, unlocked, slots, readOnly, onToggle }: any) {
  const ownedItems = items.filter((item: any) => unlocked.includes(item.id));
  return (
    <section className="panel">
      <h2>{title} {selected.length}/{slots}</h2>
      <p className="eyebrow">所持 {ownedItems.length}件 / {readOnly ? '閲覧のみ' : 'タップで装備切替'}</p>
      <div className="equipment-grid">
        {ownedItems.map((item: any) => {
          const active = selected.includes(item.id);
          return (
            <button
              key={item.id}
              className={active ? 'equipment-card active' : 'equipment-card'}
              disabled={readOnly || (!active && selected.length >= slots)}
              onClick={() => onToggle(item.id, active)}
            >
              <span className="rarity-pill">{rarityLabel(item.rarity)}</span>
              <strong>{item.name}</strong>
              <span>{active ? '装備中' : '所持'}</span>
              <span>{item.summary}</span>
              {item.detail && <small>{item.detail}</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MatchView({ game, commit }: ViewProps) {
  const match = game.currentMatch;
  const options = getInstructionOptions(game);
  const [advanceMode, setAdvanceMode] = useState<'play' | 'decision' | 'game'>('decision');
  if (match.status === 'final') {
    return (
      <section className="view-stack">
        <section className="panel match-panel">
          <p className="eyebrow">試合終了</p>
          <h2>{teamName(game.teamId)} {match.playerScore} - {match.opponentScore} {match.opponentName}</h2>
          <p>{match.finalResult.summary}</p>
          <div className="mini-metrics">
            <Metric label="勝敗" value={match.finalResult.playerWon ? '勝利' : '敗戦'} />
          <Metric label="使用作戦" value={`${match.usedInstructions.filter((item: any) => item.tacticId !== 'hold').length}`} />
          <Metric label="残りP" value={match.managerPoints} />
          </div>
          {match.growthResults?.length > 0 && <p className="small-note">成長: {match.growthResults.join(' / ')}</p>}
        </section>
        <section className="panel">
          <h2>主要成績</h2>
          <LogList entries={match.finalResult.keyStats} />
        </section>
        <section className="panel">
          <h2>作戦ログ</h2>
          <LogList
            entries={match.usedInstructions.map((entry: any) => `${entry.before.shortLabel}: ${entry.name} / ${entry.after.playerScore}-${entry.after.opponentScore} / ${entry.probabilityText}`)}
            empty="作戦使用なし"
          />
          <button className="primary-button" onClick={() => commit(confirmMatchResult, '試合結果を確認しました。')}>
            結果を確定して進む
          </button>
        </section>
      </section>
    );
  }

  if (match.status === 'result' && match.lastInstructionResult) {
    const result = match.lastInstructionResult;
    return (
      <section className="view-stack">
        <section className="panel match-panel">
          <p className="eyebrow">作戦結果</p>
          <h2>{result.name}</h2>
          <p>{result.advanceMode === 'play' ? '一プレーの結果です。' : `${result.before.shortLabel}から半イニング終了までの結果です。`}</p>
          <div className="mini-metrics">
            <Metric label="開始" value={`${result.before.playerScore}-${result.before.opponentScore}`} />
            <Metric label="終了" value={`${result.after.playerScore}-${result.after.opponentScore}`} />
            <Metric label="アウト" value={`${result.after.outs}`} />
            <Metric label="走者" value={result.after.baseText} />
          </div>
          <p className="small-note">補正: {result.effectsText}</p>
          <p className="small-note">推定確率: {result.probabilityText}</p>
        </section>
        <section className="panel">
          <h2>打席結果</h2>
          <LogList entries={result.plays.map((play: any) => play.text)} />
          <div className="action-buttons">
            <button className="primary-button" onClick={() => commit(continueMatch, '次の場面へ進みました。')}>
              次の作戦場面へ
            </button>
            <button className="secondary-button" onClick={() => commit(skipCurrentMatch, 'この試合を最後まで自動進行しました。')}>
              試合終了までスキップ
            </button>
          </div>
        </section>
      </section>
    );
  }

  const situation = match.situation;
  return (
    <section className="view-stack">
      <div className="panel match-panel">
        <p className="eyebrow">{match.kind === 'postseason' ? 'ポストシーズン' : `通常R${match.round}`}</p>
        <h2>{teamName(game.teamId)} {match.playerScore} - {match.opponentScore} {match.opponentName}</h2>
        {situation && <SituationPanel situation={situation} context={match.context} />}
      </div>
      <section className="panel">
        <h2>指示 {match.interventionCount}/{3}</h2>
        <div className="segmented-control" aria-label="作戦後の進行方法">
          {[
            ['play', '一プレーずつ'],
            ['decision', '次の作戦場面まで'],
            ['game', '試合終了まで']
          ].map(([id, label]) => (
            <button key={id} className={advanceMode === id ? 'active' : ''} onClick={() => setAdvanceMode(id as any)}>
              {label}
            </button>
          ))}
        </div>
        <div className="command-list">
          {options.map((option: any) => (
            <button
              key={option.id}
              className="command-card"
              disabled={option.disabled}
              onClick={() => commit((next) => applyMatchInstruction(next, option.id, advanceMode), `${option.name}で試合を進めました。`)}
            >
              <span>{option.cost}P</span>
              <strong>{option.name}</strong>
              <small>{option.duration}</small>
              <small>{option.effectsText}</small>
              <small>{option.summary}</small>
              {option.detail && <small>{option.detail}</small>}
              {option.disabled && option.reason && <small className="warning-text">{option.reason}</small>}
            </button>
          ))}
        </div>
        <button className="ghost-button" onClick={() => commit(skipCurrentMatch, 'この試合を最後まで自動進行しました。')}>
          この試合をスキップ
        </button>
      </section>
    </section>
  );
}

function SituationPanel({ situation, context }: any) {
  return (
    <div className="situation-box">
      <div>
        <strong>{situation.shortLabel}</strong>
        <span>{situation.offenseIsPlayer ? '自チーム攻撃中' : '自チーム守備中'}</span>
      </div>
      <BaseDiamond bases={situation.bases} />
      <div className="mini-metrics">
        <Metric label="アウト" value={`${situation.outs}`} />
        <Metric label="走者" value={situation.baseText} />
        <Metric label="監督P" value={situation.managerPoints} />
      </div>
      <p>{context.description}</p>
      <p className="small-note">打者: {situation.batterName} / 投手: {situation.pitcherName}</p>
    </div>
  );
}

function BaseDiamond({ bases }: { bases: boolean[] }) {
  return (
    <div className="base-diamond" aria-label={`走者 ${bases.map((base, index) => (base ? `${index + 1}塁` : '')).filter(Boolean).join(' ') || 'なし'}`}>
      <span className={bases[1] ? 'base active second' : 'base second'}>2</span>
      <span className={bases[2] ? 'base active third' : 'base third'}>3</span>
      <span className={bases[0] ? 'base active first' : 'base first'}>1</span>
      <span className="home-base">H</span>
    </div>
  );
}

function RewardView({ game, commit }: ViewProps) {
  const offer = game.rewardOffer;
  const canPay = game.funds >= offer.cost;
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">ラウンド報酬</p>
          <h2>{rewardTierLabel(offer.tier)}</h2>
          <p>{offer.cost > 0 ? `獲得には球団資金${offer.cost}が必要です。` : '1つ選んで次へ進みます。'}</p>
        </div>
        <button className="ghost-button" onClick={() => commit(skipReward, '報酬を見送りました。')}>
          見送る
        </button>
      </div>
      <div className="candidate-grid">
        {offer.options.map((reward: any) => (
          <article className="card" key={reward.id}>
            <span className="rarity-pill">{rarityLabel(reward.rarity)}</span>
            <h3>{reward.label}</h3>
            <p>{reward.description}</p>
            <RewardDetail reward={reward} game={game} />
            <button className="primary-button" disabled={!canPay} onClick={() => commit((next) => claimReward(next, reward.id), `${reward.label}を獲得しました。`)}>
              {offer.cost > 0 ? `${offer.cost}資金で獲得` : '獲得'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RewardDetail({ reward, game }: any) {
  if (reward.type === 'veteran') {
    const player = reward.payload.player;
    return (
      <div className="reward-detail">
        <p className="eyebrow">{player.age}歳 / {player.position} / {player.batsThrows}</p>
        <div className="ability-grid compact-grid">
          {getAbilityEntries(player).map(({ key, label }: any) => {
            const value = player.abilities[key];
            return (
            <div key={key}>
              <span>{label}</span>
              <meter min={0} max={100} value={Number(value)} />
              <strong>{String(value)}</strong>
            </div>
            );
          })}
        </div>
        <p className="tags">{player.traits.join(' / ')}</p>
      </div>
    );
  }
  if (reward.type === 'tactic') {
    const tactic = TACTICS.find((item) => item.id === reward.payload.id);
    return tactic ? (
      <div className="reward-detail">
        <p>{tactic.detail}</p>
        <p className="small-note">条件: {tactic.side === 'offense' ? '攻撃中' : '守備中'} / 持続: {tactic.duration === 'halfInning' ? '半イニング' : '1打席'} / コスト: {tactic.cost}P</p>
        <p className="small-note">現在: {game.unlocked.tactics.includes(tactic.id) ? '所持済み。重複時は素材化' : '未所持'}</p>
      </div>
    ) : null;
  }
  if (reward.type === 'training') {
    const plan = TRAINING_PLANS.find((item) => item.id === reward.payload.id);
    return plan ? (
      <div className="reward-detail">
        <p>{plan.summary}</p>
        <p className="small-note">現在: {game.unlocked.training.includes(plan.id) ? '所持済み。重複時は素材化' : '未所持'} / 装備枠を1枠使用</p>
      </div>
    ) : null;
  }
  if (reward.type === 'item') {
    const item = CONSUMABLE_ITEMS.find((entry) => entry.id === reward.payload.itemId);
    return item ? <p className="small-note">使用条件: {item.usePhase === 'any' ? 'いつでも' : item.usePhase} / 対象: {item.target === 'player' ? '選手' : 'なし'}</p> : null;
  }
  if (reward.type === 'funds') return <p className="small-note">現在資金 {game.funds} → {game.funds + reward.payload.amount}</p>;
  if (reward.type === 'materials') return <p className="small-note">現在素材 {game.materials} → {game.materials + reward.payload.amount}</p>;
  if (reward.type === 'xp') return <p className="small-note">全所属選手に分配。若手育成方針と相性が良い報酬です。</p>;
  return null;
}

function PostseasonView({ game, commit }: ViewProps) {
  const postseason = game.postseason;
  const stageLabel = postseason.stageLabel ?? (postseason.stage === 'japanSeries' ? '日本シリーズ' : 'クライマックスシリーズ');
  const playerTotal = postseason.playerWins + (postseason.playerAdvantageWins ?? 0);
  const opponentTotal = postseason.opponentWins + (postseason.opponentAdvantageWins ?? 0);
  const remaining = Math.max(0, postseason.maxGames - postseason.gamesPlayed);
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">最終決戦</p>
          <h2>{stageLabel}</h2>
          <p>
            実戦 {postseason.playerWins}勝{postseason.opponentWins}敗{postseason.draws ? `${postseason.draws}分` : ''} /
            判定 {playerTotal}-{opponentTotal} / {postseason.winsToAdvance}勝先取 / 残り{remaining}試合
          </p>
          <p className="small-note">相手 {teamName(postseason.opponentId)} / アドバンテージ {postseason.playerAdvantageWins ?? 0}-{postseason.opponentAdvantageWins ?? 0} / 上位優先 {postseason.highSeed === 'player' ? '自軍' : postseason.highSeed === 'opponent' ? '相手' : 'なし'}</p>
        </div>
        <div className="action-buttons">
          <button className="primary-button" onClick={() => commit(startPostseasonGame, 'ポストシーズンの試合を開始しました。')}>
            試合へ
          </button>
          <button className="secondary-button" onClick={() => commit(skipNextPostseasonGame, 'この試合を自動進行しました。結果を確認してください。')}>
            この試合をスキップ
          </button>
        </div>
      </div>
      <section className="panel">
        <h2>シリーズ記録</h2>
        <LogList entries={postseason.log} />
      </section>
    </section>
  );
}

function AwardsView({ game, commit }: ViewProps) {
  const awards = game.awards;
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">{awards.year}年総括</p>
          <h2>{awards.reason}</h2>
          <p>{awards.champion ? '日本一達成。ビルドの成果が刻まれました。' : '来年へ向けて世代交代を進めます。'}</p>
        </div>
        <button className="primary-button" onClick={() => commit(advanceToOffseason, 'オフシーズンに入りました。')}>
          オフシーズンへ
        </button>
      </div>
      <section className="panel">
        <h2>表彰</h2>
        <LogList entries={awards.awards.map((entry: any) => `${entry.title}: ${entry.playerName} / ${entry.note}`)} />
      </section>
      <section className="panel">
        <h2>世代交代</h2>
        <LogList entries={awards.retirements.map((entry: any) => `${entry.playerName}: ${entry.reason}`)} empty="引退・退団者なし" />
      </section>
      {awards.legacyResult.entries.length > 0 && (
        <section className="panel">
          <h2>名将報酬</h2>
          <LogList entries={awards.legacyResult.entries} />
        </section>
      )}
    </section>
  );
}

function OffseasonView({ game, commit }: ViewProps) {
  const [targetId, setTargetId] = useState(game.roster[0]?.id ?? '');
  const target = game.roster.find((player: Player) => player.id === targetId) ?? game.roster[0];
  const usedCoach = game.offseason.actionCounts?.coach ?? 0;
  const expected = Math.max(1, Math.round(CONFIG.development.directCoachBase / (usedCoach + 1)));
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">オフシーズン</p>
          <h2>残り{game.offseason.actionsLeft}回</h2>
          <p>同じ行動を重ねると、同一年内の効果は低下します。</p>
        </div>
        <button className="secondary-button" onClick={() => commit(beginNextYearDraft, '次年度ドラフトへ進みました。')}>
          ドラフトへ
        </button>
      </div>
      <section className="panel offseason-actions">
        <button onClick={() => commit((next) => performOffseasonAction(next, 'course'), '講習を受けました。')}>
          <strong>講習を受ける</strong>
          <span>監督特殊能力を獲得または強化</span>
          <small>行動1回消費。候補から1つを最大Lv2まで強化。</small>
        </button>
        <button onClick={() => commit((next) => performOffseasonAction(next, 'scout'), '視察を行いました。')}>
          <strong>視察</strong>
          <span>次回ドラフト候補と情報精度を強化</span>
          <small>行動1回消費。候補数と推定範囲の精度を上げる。</small>
        </button>
        <div className="coach-box">
          <label>
            指導対象
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              {game.roster.map((player: Player) => (
                <option key={player.id} value={player.id}>
                  {player.name} {player.position}
                </option>
              ))}
            </select>
          </label>
          {target && (
            <div className="coach-detail">
              <p className="eyebrow">{target.age}歳 / {target.position} / 疲労{target.fatigue}</p>
              <div className="ability-grid compact-grid">
                {getAbilityEntries(target).map(({ key, label }: any) => {
                  const value = target.abilities[key];
                  const base = target.seasonBaseline?.abilities?.[key];
                  const delta = typeof base === 'number' ? Number(value) - base : null;
                  return (
                    <div key={key}>
                      <span>{label}</span>
                      <meter min={0} max={100} value={Number(value)} />
                      <strong>{value}{delta !== null && ` (${delta >= 0 ? '+' : ''}${delta})`}</strong>
                    </div>
                  );
                })}
              </div>
              <p className="small-note">今回の期待成長: ランダムな対象能力に合計+{expected} / 費用なし / 行動1回消費</p>
            </div>
          )}
          <button onClick={() => commit((next) => performOffseasonAction(next, 'coach', targetId), '直接指導しました。')}>
            <strong>直接指導</strong>
            <span>対象選手の能力を上げる</span>
            <small>行動1回消費。確定後に実増分をログへ表示。</small>
          </button>
        </div>
      </section>
      {game.offseason.lastCoachResult && (
        <section className="panel">
          <h2>直近の指導結果</h2>
          <p>{game.offseason.lastCoachResult.playerName}: {game.offseason.lastCoachResult.detail}</p>
        </section>
      )}
      <section className="panel">
        <h2>行動ログ</h2>
        <LogList entries={game.offseason.log} />
      </section>
    </section>
  );
}

function TeamView({ game, commit }: ViewProps) {
  const [selectedId, setSelectedId] = useState(game.roster[0]?.id ?? '');
  const selected = game.roster.find((player: Player) => player.id === selectedId) ?? game.roster[0];
  const readOnly = game.phase === 'match';
  return (
    <section className="view-stack">
      <LineupEditor game={game} commit={commit} readOnly={readOnly} />
      <PitchingPlanEditor game={game} commit={commit} readOnly={readOnly} />
      <section className="panel">
        <h2>選手一覧</h2>
        <div className="player-list">
          {game.roster.map((player: Player) => (
            <button key={player.id} className={selected?.id === player.id ? 'player-row active' : 'player-row'} onClick={() => setSelectedId(player.id)}>
              <span>{player.position}</span>
              <strong>{player.name}</strong>
              <span>{player.age}歳</span>
              <span>総合{playerOverall(player)}</span>
            </button>
          ))}
        </div>
      </section>
      {selected && <PlayerProfile game={game} player={selected} commit={commit} />}
    </section>
  );
}

function LineupEditor({ game, commit, readOnly }: ViewProps & { readOnly: boolean }) {
  const plan = getRosterPlan(game);
  const hitters = game.roster.filter((player: Player) => player.role === 'hitter');
  const used = new Set(plan.lineup.map((slot: any) => slot.playerId));
  return (
    <section className="panel">
      <div className="card-head">
        <div>
          <p className="eyebrow">スタメンと打順</p>
          <h2>野手9枠</h2>
        </div>
        <span className="rarity-pill">{readOnly ? '試合中は閲覧のみ' : '変更可'}</span>
      </div>
      <div className="lineup-editor">
        {plan.lineup.map((slot: any, index: number) => {
          const player = game.roster.find((entry: Player) => entry.id === slot.playerId);
          return (
            <div className="lineup-row" key={`${slot.position}-${index}`}>
              <strong>{index + 1}</strong>
              <select
                value={slot.position}
                disabled={readOnly}
                onChange={(event) => commit((next) => updateLineupSlot(next, index, { position: event.target.value }), '守備位置を変更しました。')}
              >
                {(CONFIG.roster.lineupPositions as string[]).map((position) => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
              <select
                value={slot.playerId}
                disabled={readOnly}
                onChange={(event) => commit((next) => updateLineupSlot(next, index, { playerId: event.target.value }), 'スタメンを変更しました。')}
              >
                {hitters
                  .filter((candidate: Player) => candidate.id === slot.playerId || !used.has(candidate.id))
                  .map((candidate: Player) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} {candidate.age}歳 総合{playerOverall(candidate)} / {candidate.defensePositions?.join(',')}
                    </option>
                  ))}
              </select>
              <span>{player ? `疲労${player.fatigue} ${abilityLabelForPlayer(player, 'fielding')}${player.abilities.fielding}` : '未登録'}</span>
              <div className="row-buttons">
                <button className="ghost-button small-button" disabled={readOnly || index === 0} onClick={() => commit((next) => moveLineupSlot(next, index, -1), '打順を上げました。')}>↑</button>
                <button className="ghost-button small-button" disabled={readOnly || index === plan.lineup.length - 1} onClick={() => commit((next) => moveLineupSlot(next, index, 1), '打順を下げました。')}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PitchingPlanEditor({ game, commit, readOnly }: ViewProps & { readOnly: boolean }) {
  const plan = getRosterPlan(game);
  const pitchers = game.roster.filter((player: Player) => player.role === 'pitcher');
  const used = new Set([...plan.rotation, ...(plan.bullpen?.relievers ?? []), plan.bullpen?.closerId].filter(Boolean));
  const pitcherOptions = (role: string, currentId: string) =>
    pitchers.filter((player: Player) => player.position === role && (player.id === currentId || !used.has(player.id)));
  return (
    <section className="panel">
      <div className="card-head">
        <div>
          <p className="eyebrow">投手起用</p>
          <h2>先発ローテ・救援</h2>
        </div>
        <span className="rarity-pill">次の先発 {plan.nextStarterIndex + 1}番手</span>
      </div>
      <div className="pitching-editor">
        {plan.rotation.map((playerId: string, index: number) => (
          <PitchingSelect
            key={`rotation-${index}`}
            label={`先発${index + 1}`}
            role="先発"
            value={playerId}
            options={pitcherOptions('先発', playerId)}
            readOnly={readOnly}
            onChange={(id: string) => commit((next) => updatePitchingPlan(next, 'rotation', index, id), '先発ローテを変更しました。')}
          />
        ))}
        {(plan.bullpen?.relievers ?? []).map((playerId: string, index: number) => (
          <PitchingSelect
            key={`reliever-${index}`}
            label={`中継ぎ${index + 1}`}
            role="中継ぎ"
            value={playerId}
            options={pitcherOptions('中継ぎ', playerId)}
            readOnly={readOnly}
            onChange={(id: string) => commit((next) => updatePitchingPlan(next, 'relievers', index, id), '中継ぎを変更しました。')}
          />
        ))}
        <PitchingSelect
          label="抑え"
          role="抑え"
          value={plan.bullpen?.closerId}
          options={pitcherOptions('抑え', plan.bullpen?.closerId)}
          readOnly={readOnly}
          onChange={(id: string) => commit((next) => updatePitchingPlan(next, 'closer', 0, id), '抑えを変更しました。')}
        />
      </div>
    </section>
  );
}

function PitchingSelect({ label, value, options, readOnly, onChange }: any) {
  const current = options.find((player: Player) => player.id === value);
  return (
    <label className="pitching-select">
      {label}
      <select value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value)}>
        {options.map((player: Player) => (
          <option key={player.id} value={player.id}>
            {player.name} 総合{playerOverall(player)} 疲労{player.fatigue}
          </option>
        ))}
      </select>
      {current && <small>{abilityLabelForPlayer(current, 'power')}{current.abilities.power} / {abilityLabelForPlayer(current, 'stamina')}{current.abilities.stamina}</small>}
    </label>
  );
}

function PlayerProfile({ game, player, commit }: { game: GameState; player: Player; commit: Commit }) {
  const rates = player.role === 'hitter' ? battingRates(player.stats) : pitchingRates(player.stats);
  const rewind = game.inventory.find((item: any) => item.itemId === 'prime-rewind');
  return (
    <section className="panel profile-panel">
      <div className="card-head">
        <div>
          <p className="eyebrow">{player.position} / {player.batsThrows}</p>
          <h2>{player.name}</h2>
        </div>
        <span className="rarity-pill">総合{playerOverall(player)}</span>
      </div>
      <div className="mini-metrics">
        <Metric label="年齢" value={`${player.age}`} />
        <Metric label="潜在" value={`${player.potential}`} />
        <Metric label="調子" value={`${player.condition}`} />
        <Metric label="疲労" value={`${player.fatigue}`} />
      </div>
      <div className="ability-grid">
        {getAbilityEntries(player).map(({ key, label }: any) => {
          const value = player.abilities[key];
          const base = player.seasonBaseline?.abilities?.[key];
          const delta = typeof base === 'number' ? Number(value) - base : null;
          return (
            <div key={key}>
              <span>{label}</span>
              <meter min={0} max={100} value={Number(value)} />
              <strong>{String(value)}{delta !== null && ` (${delta >= 0 ? '+' : ''}${delta})`}</strong>
            </div>
          );
        })}
      </div>
      <p className="small-note">成長基準: {player.seasonBaseline?.year ?? game.year}年 {player.seasonBaseline?.reason ?? '記録開始時点'}</p>
      <section className="stat-line">
        {player.role === 'hitter' ? (
          <>
            <Metric label="AVG" value={formatAverage((rates as any).avg)} />
            <Metric label="OBP" value={formatAverage((rates as any).obp)} />
            <Metric label="SLG" value={formatAverage((rates as any).slg)} />
            <Metric label="OPS" value={formatAverage((rates as any).ops)} />
            <Metric label="HR" value={player.stats.hr} />
            <Metric label="RBI" value={player.stats.rbi} />
          </>
        ) : (
          <>
            <Metric label="ERA" value={formatFixed((rates as any).era)} />
            <Metric label="WHIP" value={formatFixed((rates as any).whip)} />
            <Metric label="IP" value={formatFixed((rates as any).innings, 1)} />
            <Metric label="SO" value={player.stats.so} />
          </>
        )}
      </section>
      <p className="tags">{player.traits.join(' / ')}</p>
      {rewind && (
        <button className="secondary-button" disabled={player.rejuvenated} onClick={() => commit((next) => useItem(next, rewind.instanceId, player.id), '衰えを巻き戻しました。')}>
          全盛期の記録映像を使う
        </button>
      )}
      <section>
        <h3>今年度の成長</h3>
        <LogList
          entries={(player.growthLog ?? [])
            .filter((entry: any) => entry.year === game.year)
            .map((entry: any) => `${entry.reason}: ${entry.changes.map((change: any) => `${change.label}+${change.amount}`).join(' / ')}`)}
          empty="今年度の成長記録はまだありません"
        />
      </section>
      <section>
        <h3>年度別成績</h3>
        <LogList entries={player.history.slice(-5).map((entry: any) => `${entry.year}年 ${entry.age}歳 総合${entry.overall}`)} empty="まだ年度別成績はありません" />
      </section>
    </section>
  );
}

function LegacyView({ game, commit }: ViewProps) {
  const available = getAvailableFamePoints(game);
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">名将ポイント</p>
          <h2>未使用 {available} / 合計 {game.manager.legacy.famePoints}</h2>
          <p>最高ハード値 {game.manager.legacy.highestHardValue} / 現在の条件値 {calculateHardValue(game)}</p>
        </div>
        <button className="ghost-button" onClick={() => commit(resetLegacyPerks, '名将ポイントを振り直しました。')}>
          振り直し
        </button>
      </div>
      <section className="panel">
        <h2>パーク</h2>
        <div className="equipment-grid">
          {LEGACY_PERKS.map((perk) => {
            const level = game.manager.legacy.perks[perk.id] ?? 0;
            return (
              <button key={perk.id} className="equipment-card" disabled={available < perk.cost || level >= perk.maxLevel} onClick={() => commit((next) => purchaseLegacyPerk(next, perk.id), `${perk.name}を取得しました。`)}>
                <span>{level}/{perk.maxLevel}</span>
                <strong>{perk.name}</strong>
                <span>{perk.summary}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>ハード条件</h2>
        {!game.manager.legacy.hardUnlocked && <p>ノーマル日本一で解放されます。</p>}
        <div className="equipment-grid">
          {HARD_CONDITIONS.map((condition) => {
            const active = game.manager.hardConditions.includes(condition.id);
            return (
              <button key={condition.id} className={active ? 'equipment-card active' : 'equipment-card'} disabled={!game.manager.legacy.hardUnlocked} onClick={() => commit((next) => toggleHardCondition(next, condition.id), active ? 'ハード条件を外しました。' : 'ハード条件を追加しました。')}>
                <span>+{condition.value}</span>
                <strong>{condition.name}</strong>
                <span>{condition.summary}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>消費アイテム</h2>
        <div className="inventory-list">
          {game.inventory.length === 0 && <p>所持アイテムなし</p>}
          {game.inventory.map((instance: any) => {
            const item = CONSUMABLE_ITEMS.find((entry) => entry.id === instance.itemId);
            return (
              <button key={instance.instanceId} onClick={() => commit((next) => useItem(next, instance.instanceId), `${item?.name ?? 'アイテム'}を使いました。`)}>
                <strong>{item?.name}</strong>
                <span>{item?.summary}</span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function SettingsView({ game, setGame, resetGame, setMessage }: any) {
  const [text, setText] = useState('');
  const exportText = useMemo(() => exportGame(game), [game]);
  const download = () => {
    const blob = new Blob([exportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kantoku-hackslash-${game.year}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importFromText = () => {
    try {
      setGame(importGame(text));
      setMessage('セーブデータを読み込みました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '読み込みに失敗しました。');
    }
  };
  return (
    <section className="view-stack">
      <section className="panel">
        <h2>セーブ</h2>
        <div className="settings-actions">
          <button className="primary-button" onClick={download}>JSONを書き出し</button>
          <label className="file-button">
            JSONを読み込み
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                file.text().then((content) => {
                  try {
                    setGame(importGame(content));
                    setMessage('セーブデータを読み込みました。');
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : '読み込みに失敗しました。');
                  }
                });
              }}
            />
          </label>
          <button className="danger-button" onClick={resetGame}>セーブ削除</button>
        </div>
        <textarea value={exportText} readOnly aria-label="書き出しJSON" />
      </section>
      <section className="panel">
        <h2>JSON貼り付け読み込み</h2>
        <textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="読み込みJSON" />
        <button className="secondary-button" onClick={importFromText}>読み込む</button>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function TeamBadge({ teamId, large = false, compact = false }: { teamId: string; large?: boolean; compact?: boolean }) {
  const team = TEAMS.find((entry) => entry.id === teamId) ?? TEAMS[0];
  const style = { '--team-color': team.color, '--team-accent': team.accent } as any;
  return (
    <span className={large ? 'team-badge large' : compact ? 'team-badge compact' : 'team-badge'} style={style} aria-label={team.name}>
      {team.shortName.slice(0, 1)}
    </span>
  );
}

function LogList({ entries, empty = '記録なし' }: { entries: string[]; empty?: string }) {
  if (!entries.length) return <p>{empty}</p>;
  return (
    <ul className="log-list">
      {entries.map((entry, index) => (
        <li key={`${entry}-${index}`}>{entry}</li>
      ))}
    </ul>
  );
}

function teamName(teamId: string) {
  return TEAMS.find((team) => team.id === teamId)?.name ?? teamId;
}

function rarityLabel(rarity: string) {
  if (rarity === 'masterwork') return '名品';
  if (rarity === 'quality') return '上質';
  return '通常';
}

function rewardTierLabel(tier: string) {
  if (tier === 'strong') return '強い報酬';
  if (tier === 'final') return '最終ラウンド報酬';
  if (tier === 'postseason') return 'ポストシーズン報酬';
  return '軽い報酬';
}

function abilityLabel(key: string) {
  const labels: Record<string, string> = {
    contact: 'ミート',
    power: '長打力',
    eye: '選球眼',
    speed: '走力',
    fielding: '守備力',
    arm: '肩力',
    durability: '耐久力',
    control: '制球',
    breaking: '変化球',
    stamina: 'スタミナ'
  };
  return labels[key] ?? key;
}

function cloneGame<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

type Commit = (mutator: (state: GameState) => void, success?: string) => void;
type ViewProps = { game: GameState; commit: Commit };

export default App;
