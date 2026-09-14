export const LEAGUES = [
  { id: 'east', name: '東都リーグ' },
  { id: 'west', name: '西都リーグ' }
];

export const TEAMS = [
  { id: 'kita-meteors', league: 'east', name: '北星メテオズ', shortName: '北星', color: '#1f5f8b', accent: '#f2c14e', baseRating: 54 },
  { id: 'minato-blades', league: 'east', name: '港都ブレイズ', shortName: '港都', color: '#b5413a', accent: '#f6e7d8', baseRating: 51 },
  { id: 'sazanami-arcs', league: 'east', name: '漣アークス', shortName: '漣', color: '#186f65', accent: '#b7e4d8', baseRating: 49 },
  { id: 'asahi-caps', league: 'east', name: '旭キャップス', shortName: '旭', color: '#593c8f', accent: '#ffd166', baseRating: 47 },
  { id: 'komorebi-foxes', league: 'east', name: '木漏ファングス', shortName: '木漏', color: '#3d405b', accent: '#e07a5f', baseRating: 46 },
  { id: 'tokiwa-forge', league: 'east', name: '常盤フォージ', shortName: '常盤', color: '#2d6a4f', accent: '#fefae0', baseRating: 50 },
  { id: 'naniwa-hammers', league: 'west', name: '浪花ハンマーズ', shortName: '浪花', color: '#7f4f24', accent: '#fcbf49', baseRating: 53 },
  { id: 'seiran-wings', league: 'west', name: '青嵐ウイングス', shortName: '青嵐', color: '#006d77', accent: '#ffddd2', baseRating: 52 },
  { id: 'akatsuki-sparks', league: 'west', name: '暁スパークス', shortName: '暁', color: '#9b2226', accent: '#ee9b00', baseRating: 50 },
  { id: 'yamabuki-stags', league: 'west', name: '山吹スタッグス', shortName: '山吹', color: '#588157', accent: '#dad7cd', baseRating: 48 },
  { id: 'shiranui-comets', league: 'west', name: '不知火コメッツ', shortName: '不知火', color: '#343a40', accent: '#90e0ef', baseRating: 46 },
  { id: 'hakuro-crowns', league: 'west', name: '白露クラウンズ', shortName: '白露', color: '#4a4e69', accent: '#f2e9e4', baseRating: 45 }
];

export const TACTICS = [
  {
    id: 'first-pitch',
    name: '初球攻勢',
    rarity: 'normal',
    tags: ['攻撃', 'テンポ'],
    cost: 1,
    summary: '安打と長打を少し上げる。四球は減る。',
    detail: '初球から狙わせ、得点期待を上げる。待球型打線とは噛み合いにくい。',
    effects: { hit: 0.018, hr: 0.006, walk: -0.014 }
  },
  {
    id: 'patient-bat',
    name: '待球指示',
    rarity: 'normal',
    tags: ['攻撃', '選球'],
    cost: 1,
    summary: '四球を増やす。単打率は少し下がる。',
    detail: '相手投手に球数を投げさせる。長打の即効性は低い。',
    effects: { hit: -0.008, walk: 0.035, opponentFatigue: 2 }
  },
  {
    id: 'guard-power',
    name: '長打警戒',
    rarity: 'normal',
    tags: ['守備', '投手'],
    cost: 1,
    summary: '被本塁打を抑える。四球は少し増える。',
    detail: '長打を嫌って慎重に攻める。僅差の終盤に向く。',
    effects: { preventHr: 0.018, preventHit: 0.004, pitcherWalk: 0.012 }
  },
  {
    id: 'draw-in',
    name: '前進守備',
    rarity: 'quality',
    tags: ['守備', '接戦'],
    cost: 1,
    summary: '直近の失点期待を下げる。長打リスクが上がる。',
    detail: '同点や一点差の終盤に内野を前へ出す。',
    effects: { preventHit: 0.018, preventHr: -0.01, runPrevention: 0.18 }
  },
  {
    id: 'pinch-wave',
    name: '代打攻勢',
    rarity: 'quality',
    tags: ['攻撃', '勝負'],
    cost: 2,
    summary: '次の攻撃だけ大きく押す。野手疲労が増える。',
    detail: '控えも含めて最も噛み合う打者を投入する。',
    effects: { hit: 0.036, hr: 0.014, fatigueHitters: 4 }
  },
  {
    id: 'bullpen-map',
    name: '継投策',
    rarity: 'masterwork',
    tags: ['投手', '終盤'],
    cost: 2,
    summary: '終盤の失点期待を大きく下げる。投手疲労が増える。',
    detail: '相手打順に合わせて救援陣を前倒しする。',
    effects: { preventHit: 0.032, preventHr: 0.012, fatiguePitchers: 5 }
  }
];

export const TRAINING_PLANS = [
  {
    id: 'slug-lab',
    name: '長打力強化',
    rarity: 'normal',
    tags: ['打撃'],
    summary: '長打力+5、三振が少し増える。',
    effects: { power: 5, strikeout: 0.01, fatigue: 1 }
  },
  {
    id: 'zone-discipline',
    name: '選球眼強化',
    rarity: 'normal',
    tags: ['打撃', '選球'],
    summary: '選球眼+5、初球攻勢の効果は少し下がる。',
    effects: { eye: 5, contact: -1 }
  },
  {
    id: 'defense-chain',
    name: '守備連携',
    rarity: 'normal',
    tags: ['守備'],
    summary: '守備力+4、投手の被安打を少し抑える。',
    effects: { fielding: 4, preventHit: 0.006 }
  },
  {
    id: 'basepath-reform',
    name: '走塁改革',
    rarity: 'quality',
    tags: ['走塁'],
    summary: '走力+5、長打時の得点効率が上がる。',
    effects: { speed: 5, runConversion: 0.12, fatigue: 1 }
  },
  {
    id: 'youth-forge',
    name: '若手育成',
    rarity: 'quality',
    tags: ['育成'],
    summary: '24歳以下の成長量+30%、ベテランの即効性は低い。',
    effects: { youthGrowth: 0.3, veteranDecline: 0.05 }
  },
  {
    id: 'veteran-core',
    name: 'ベテラン重用',
    rarity: 'masterwork',
    tags: ['再生', '安定'],
    summary: '31歳以上の衰えを軽減し、若手経験値は少し減る。',
    effects: { veteranDecline: -0.25, youthGrowth: -0.08 }
  }
];

export const CONSUMABLE_ITEMS = [
  {
    id: 'elite-scout-note',
    name: '特A視察ノート',
    rarity: 'quality',
    summary: '次回ドラフトに高潜在能力候補を最低1人追加する。',
    usePhase: 'any'
  },
  {
    id: 'draft-redraw',
    name: 'ドラフト再抽選券',
    rarity: 'normal',
    summary: 'ドラフト候補を再抽選する。',
    usePhase: 'draft'
  },
  {
    id: 'decline-freeze',
    name: '今季衰え停止',
    rarity: 'quality',
    summary: '今季終了時の衰え判定を止める。',
    usePhase: 'any'
  },
  {
    id: 'prime-rewind',
    name: '全盛期の記録映像',
    rarity: 'masterwork',
    summary: '対象選手の衰えを一度だけ巻き戻す。',
    usePhase: 'any',
    target: 'player'
  },
  {
    id: 'double-reinforce',
    name: '補強枠追加メモ',
    rarity: 'quality',
    summary: '次の報酬補強で2人獲得できる。',
    usePhase: 'any'
  },
  {
    id: 'training-lease',
    name: '臨時練習枠',
    rarity: 'normal',
    summary: '今季の練習方針装備枠を1つ増やす。',
    usePhase: 'any'
  }
];

export const MANAGER_ABILITIES = [
  { id: 'scout-network', name: '広域スカウト網', type: 'scout', summary: 'ドラフト候補+1、潜在能力表示が少し狭まる。' },
  { id: 'tactics-board', name: '戦術ボード', type: 'tactics', summary: '作戦装備枠+1。' },
  { id: 'extra-point', name: '勝負勘', type: 'tactics', summary: '試合の監督ポイント+1。' },
  { id: 'farm-system', name: '育成循環', type: 'develop', summary: '若手の成長量が上がる。' },
  { id: 'care-room', name: '再生ケア', type: 'recover', summary: 'ベテランの衰えと疲労を軽減する。' }
];

export const LEGACY_PERKS = [
  { id: 'legacy-draft', name: '候補網拡大', maxLevel: 3, cost: 1, summary: 'ドラフト候補数+1。' },
  { id: 'legacy-funds', name: '初期資金', maxLevel: 3, cost: 1, summary: '新シーズン資金+20。' },
  { id: 'legacy-tactic-slot', name: '作戦枠研究', maxLevel: 1, cost: 2, summary: '作戦装備枠+1。' },
  { id: 'legacy-training-slot', name: '練習枠研究', maxLevel: 1, cost: 2, summary: '練習方針装備枠+1。' },
  { id: 'legacy-item-unlock', name: '秘蔵品解放', maxLevel: 2, cost: 1, summary: '名品アイテムの出現率を少し上げる。' }
];

export const HARD_CONDITIONS = [
  { id: 'npc-plus', name: 'NPC能力上昇', value: 3, summary: 'NPCの基礎戦力+5。' },
  { id: 'funds-down', name: '資金減少', value: 2, summary: 'シーズン開始資金-35。' },
  { id: 'offseason-minus', name: '行動回数-1', value: 4, summary: 'オフシーズン行動が1回減る。' },
  { id: 'draft-minus', name: '指名上限-1', value: 4, summary: 'ドラフト獲得上限が1人減る。' },
  { id: 'tactic-slot-down', name: '作戦枠-1', value: 4, summary: '作戦装備枠が1つ減る。' },
  { id: 'training-slot-down', name: '練習枠-1', value: 4, summary: '練習方針装備枠が1つ減る。' },
  { id: 'fatigue-up', name: '疲労増加', value: 3, summary: '試合後の疲労が増える。' },
  { id: 'rank-demand', name: '順位条件', value: 4, summary: 'リーグ2位以内でなければCS進出不可。' }
];

export const GROWTH_TYPES = [
  { id: 'early', name: '早熟' },
  { id: 'normal', name: '標準' },
  { id: 'late', name: '晩成' },
  { id: 'steady', name: '持続' }
];

export const PLAYER_TRAITS = [
  '逆境',
  '選球職人',
  '広角打法',
  '鉄壁',
  '快足',
  '剛腕',
  '精密制球',
  '回復力',
  '勝負強さ',
  'ムードメーカー'
];

export const HITTER_POSITIONS = ['捕手', '一塁手', '二塁手', '三塁手', '遊撃手', '外野手'];
export const PITCHER_POSITIONS = ['先発', '中継ぎ', '抑え'];

export const FAMILY_NAMES = [
  '朝霧',
  '灯野',
  '伊吹',
  '海老名',
  '大鳥',
  '風見',
  '神代',
  '霧島',
  '久遠',
  '小早川',
  '榊',
  '篠宮',
  '高峰',
  '月城',
  '鳴海',
  '白瀬',
  '日向',
  '真壁',
  '御影',
  '八雲',
  '結城',
  '若槻'
];

export const GIVEN_NAMES = [
  '蒼',
  '蓮',
  '湊',
  '樹',
  '律',
  '航',
  '晴',
  '司',
  '要',
  '慧',
  '凪',
  '拓真',
  '悠斗',
  '真人',
  '大和',
  '一成',
  '玲央',
  '祥太',
  '遥斗',
  '直央'
];

export const SCOUT_REPORTS = [
  '完成度が高く、早い時期から一軍戦力として計算できる。',
  '粗さはあるが、鍛え方次第で主軸級まで伸びる。',
  '守備と走塁で試合に入れるため、出場機会を与えやすい。',
  '制球に課題は残るが、球の強さは候補内でも目立つ。',
  '故障リスクはやや気になるが、天井の高さは魅力。',
  '派手さはないが、チームの穴を埋める現実的な指名候補。'
];
