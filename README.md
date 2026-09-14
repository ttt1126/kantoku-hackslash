# 監督ハクスラ

1人用の日本語ブラウザゲームです。監督として架空球団を率い、ドラフト、作戦・練習ビルド、試合中の采配、報酬獲得、ポストシーズン、世代交代を1年単位で回します。

## セットアップ

```bash
npm install
npm run dev
```

開発サーバー起動後、表示されたURLをスマートフォン幅のブラウザで開いてください。

## テスト

```bash
npm test
```

主な検証対象:

- ドラフト獲得上限
- AI指名による候補消失
- 8ラウンドからポストシーズンへの進行
- 日本シリーズ4勝先取
- 加齢、成長、衰え、引退
- 作戦と練習の装備枠
- 報酬レアリティ抽選
- 消費アイテム使用制限
- オフシーズン行動回数
- ノーマル初クリア報酬
- 最高ハード値更新時の未獲得報酬一括付与
- 同じハード値の再クリアで名将ポイントを重複付与しない
- セーブ、読み込み、乱数状態の再現性

## ビルド

```bash
npm run build
npm run preview
```

Viteの `base` は `./` にしているため、GitHub Pagesのプロジェクトページでも相対パスで動作します。

## GitHub Pages公開

`.github/workflows/deploy.yml` を追加済みです。

1. GitHubリポジトリの Settings で Pages の Source を GitHub Actions にします。
2. `main` ブランチへ push します。
3. workflow が `npm install`、`npm test`、`npm run build` を実行し、`dist` を Pages に公開します。

## PWA

- `public/manifest.webmanifest` と `public/sw.js` を同梱しています。
- 本番ビルド時のみ service worker を登録します。
- アプリ本体、manifest、アイコンをキャッシュし、取得済みアセットはオフラインで再利用します。

## セーブ

- `localStorage` に自動保存します。
- セーブデータは `schemaVersion` と乱数状態を含みます。
- 設定画面からJSONを書き出し、ファイルまたは貼り付けで読み込めます。

## 仕様メモ

MVPで採用した仮仕様、後回しにした要素、調整用定数は [GAME_DESIGN.md](./GAME_DESIGN.md) にまとめています。
