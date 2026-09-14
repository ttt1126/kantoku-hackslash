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
  beginNextYearDraft,
  calculateHardValue,
  claimReward,
  createNewGame,
  draftPlayer,
  equipTactic,
  equipTraining,
  getAvailableFamePoints,
  getInstructionOptions,
  getLeagueStandings,
  getPhaseLabel,
  getPlayerRank,
  getPlayerTeam,
  getTacticSlots,
  getTrainingSlots,
  playerOverall,
  purchaseLegacyPerk,
  resetLegacyPerks,
  skipDraft,
  skipReward,
  startNextGame,
  startPostseasonGame,
  startSeasonAfterDraft,
  teamPower,
  toggleHardCondition,
  unequipTactic,
  unequipTraining,
  useItem,
  performOffseasonAction
} from './game/engine.js';
import { battingRates, formatAverage, formatFixed, pitchingRates } from './game/stats.js';
import { clearSavedGame, exportGame, importGame, loadSavedGame, saveGame } from './game/storage';

type GameState = any;
type Player = any;

const phaseTabs = [
  { id: 'dashboard', label: '進行' },
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
  const [activeTab, setActiveTab] = useState('dashboard');
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

  const focusedPhase = ['draft', 'equipment', 'match', 'reward', 'postseason', 'awards', 'offseason'].includes(game.phase)
    ? game.phase
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
        <button className="primary-button" onClick={() => commit(startNextGame, '試合を開始しました。')}>
          次の試合へ
        </button>
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
        <LogList entries={game.matchHistory.slice(0, 5).map((match: any) => `${match.opponentName} ${match.playerScore}-${match.opponentScore} ${match.playerWon ? '勝' : '敗'} / ${match.instruction}`)} />
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
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">作戦と練習</p>
          <h2>装備枠 {game.equipment.tactics.length}/{tacticSlots} ・ {game.equipment.training.length}/{trainingSlots}</h2>
          <p>作戦は試合中のアクティブ、練習はシーズン中のパッシブです。</p>
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
        onToggle={(id, active) => commit((next) => (active ? unequipTactic(next, id) : equipTactic(next, id)), active ? '作戦を外しました。' : '作戦を装備しました。')}
      />
      <EquipmentList
        title="練習方針"
        items={TRAINING_PLANS}
        selected={game.equipment.training}
        unlocked={game.unlocked.training}
        slots={trainingSlots}
        onToggle={(id, active) => commit((next) => (active ? unequipTraining(next, id) : equipTraining(next, id)), active ? '練習方針を外しました。' : '練習方針を装備しました。')}
      />
    </section>
  );
}

function EquipmentList({ title, items, selected, unlocked, slots, onToggle }: any) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="equipment-grid">
        {items.map((item: any) => {
          const active = selected.includes(item.id);
          const locked = !unlocked.includes(item.id);
          return (
            <button
              key={item.id}
              className={active ? 'equipment-card active' : 'equipment-card'}
              disabled={locked || (!active && selected.length >= slots)}
              onClick={() => onToggle(item.id, active)}
            >
              <span className="rarity-pill">{rarityLabel(item.rarity)}</span>
              <strong>{item.name}</strong>
              <span>{locked ? '未解放' : item.summary}</span>
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
  return (
    <section className="view-stack">
      <div className="panel match-panel">
        <p className="eyebrow">{match.kind === 'postseason' ? 'ポストシーズン' : `通常R${match.round}`}</p>
        <h2>{teamName(game.teamId)} {match.playerScore} - {match.opponentScore} {match.opponentName}</h2>
        <div className="situation-box">
          <strong>{match.context.label}</strong>
          <span>{match.context.description}</span>
          <span>監督ポイント: {match.managerPoints}</span>
        </div>
      </div>
      <section className="panel">
        <h2>指示</h2>
        <div className="command-list">
          {options.map((option: any) => (
            <button
              key={option.id}
              className="command-card"
              disabled={option.disabled}
              onClick={() => commit((next) => applyMatchInstruction(next, option.id), `${option.name}で試合を進めました。`)}
            >
              <span>{option.cost}P</span>
              <strong>{option.name}</strong>
              <small>{option.effectsText}</small>
              <small>{option.summary}</small>
            </button>
          ))}
        </div>
      </section>
    </section>
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
            <button className="primary-button" disabled={!canPay} onClick={() => commit((next) => claimReward(next, reward.id), `${reward.label}を獲得しました。`)}>
              獲得
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PostseasonView({ game, commit }: ViewProps) {
  const postseason = game.postseason;
  const stageLabel = postseason.stage === 'cs' ? 'クライマックスシリーズ' : '日本シリーズ';
  const targetWins = postseason.stage === 'cs' ? 2 : 4;
  return (
    <section className="view-stack">
      <div className="panel action-panel">
        <div>
          <p className="eyebrow">最終決戦</p>
          <h2>{stageLabel}</h2>
          <p>{postseason.playerWins}勝{postseason.opponentWins}敗 / {targetWins}勝先取 / 相手 {teamName(postseason.opponentId)}</p>
        </div>
        <button className="primary-button" onClick={() => commit(startPostseasonGame, 'ポストシーズンの試合を開始しました。')}>
          試合へ
        </button>
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
        </button>
        <button onClick={() => commit((next) => performOffseasonAction(next, 'scout'), '視察を行いました。')}>
          <strong>視察</strong>
          <span>次回ドラフト候補と情報精度を強化</span>
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
          <button onClick={() => commit((next) => performOffseasonAction(next, 'coach', targetId), '直接指導しました。')}>
            <strong>直接指導</strong>
            <span>対象選手の能力を上げる</span>
          </button>
        </div>
      </section>
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
  return (
    <section className="view-stack">
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
        {Object.entries(player.abilities).map(([key, value]) => (
          <div key={key}>
            <span>{abilityLabel(key)}</span>
            <meter min={0} max={100} value={Number(value)} />
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>
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
    contact: 'コンタクト',
    power: '長打力/球威',
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
