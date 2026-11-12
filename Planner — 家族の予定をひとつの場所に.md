# Planner — 家族の予定をひとつの場所に

家族だけが使う予定管理 Web アプリです。今日と明日の予定、月のカレンダー、複数日にまたがる一括登録、対象者の複数選択、登録者の記録までを、スマートフォン中心の UI でまとめています。ホーム画面に追加すればアプリのように起動できます（PWA）。

いまは **Firebase をモックに差し替えた状態** です。画面・データ構造・認証の入り口はすべて本実装を前提に作ってあるので、`src/data/firebaseBackend.ts` を仕上げて 1 行差し替えるだけで Firebase に移行できます。

---

## 1. まず動かす

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

- ログイン画面で家族を選び、**任意のパスワード**（1 文字以上）で入れます。モックなので認証はしていません。
- 初回だけサンプルの予定が入ります。不要なら削除してください（削除すると再投入されません）。

本番と同じ形で確認するときは:

```bash
pnpm build
pnpm preview      # http://localhost:3000
```

## 2. フォルダ構成 — 何をどこに置くか

```
planner/
├── image/                  ← ロゴ原本の置き場所（あってもなくてもOK。下記参照）
├── user/                   ← 家族 CSV の置き場所（ここに置けばビルド時に自動コピー）
│   └── users.csv
├── public/
│   ├── image/logo.png      ← 実際にサイトが読み込むロゴ（差し替え対象）
│   ├── user/users.csv      ← 実際にサイトが読み込む家族 CSV（サンプル入り）
│   ├── manifest.webmanifest
│   └── sw.js
├── scripts/
│   └── sync-user-csv.mjs   ← user/*.csv を public/user/ へコピー
├── src/
│   ├── app/                ← 認証・予定・トーストの状態管理（Context）
│   ├── components/         ← ヘッダー、カレンダー、シート、カードなどの部品
│   ├── data/               ← データ層。backend.ts が差し替えポイント
│   ├── lib/                ← 日付計算、CSV パース、小さな hooks
│   ├── screens/            ← ログイン / ダッシュボード / 日別 / 新規登録
│   └── styles/             ← デザイントークンと CSS
├── firebase.json           ← Firebase Hosting 用（SPA リワイト・キャッシュ設定）
├── .env.example            ← Firebase の設定値のテンプレート
└── README.md
```

### ロゴ

サイトが読み込むのは **`public/image/logo.png`** の 1 ファイルだけです。ここを差し替えれば、ヘッダー左上・ログイン画面・ブラウザのタブ・ホーム画面アイコン（PWA）・iOS のホーム画面アイコンまで、すべて一斉に変わります。

- 推奨: **512 × 512 px の正方形 PNG**（透過可）。
- ホーム画面アイコンでは端が少し欠けることがあるので、**文字や図形の周囲に 10% 程度の余白**を残すと安全です。
- リポジトリの `image/logo.png` に原本を置きたい場合は、`public/image/logo.png` にも同じファイルを置いてください（ビルドで配信されるのは `public/` 側だけのため）。`public/image/logo.png` を消すと、内蔵の「P」マークにフォールバックします。

### 家族の CSV

**`user/users.csv`** に置いてください。`pnpm dev` / `pnpm build` のたびに `public/user/` へ自動コピーされます（`public/user/users.csv` を直接編集しても構いません）。

書式は指定どおり、ユーザー名とメールアドレスをセミコロンで区切ります。引用符はあってもなくても構いません。

```csv
"お父さん";"papa@example.com"
"お母さん";"mama@example.com"
"はると";"haruto@example.com"
"みお";"mio@example.com"
```

- 区切りは `;` と `,` の両方を自動判定します。BOM・CRLF・空行・`#` コメント行も無視します。
- 1 行目がヘッダー（`name` / `ユーザー名` など）なら自動で読み飛ばします。
- ファイル名は `users.csv` のほか `family.csv` / `members.csv` でも読み込みます。
- メールアドレスは Firebase のログインメールと一致させてください。メールはアカウントの識別子（＝予定との紐付けキー）としても使います。
- ファイルが無い／読めない場合は、同梱のサンプル 4 名が表示されます（ログイン画面の下部に「サンプルの家族情報を表示中」と出ます）。

## 3. 画面と機能

| 画面 | できること |
| --- | --- |
| ログイン | 家族の一覧から選択 → パスワード入力。未認証では他の画面に入れません。 |
| ダッシュボード | 上から「今日の予定」「明日の予定」「月のカレンダー」。カレンダーの日付をタップで日別シート。 |
| 日別シート | その日の予定一覧、削除（取り消し可）、その日への追加。 |
| 新規予定 | 名称、任意の時間帯、カレンダーで複数日選択、対象者を複数選択（必須）。 |

共通の振る舞い:

- 左上のロゴは常時表示。タップするとダッシュボードに戻ります（シート表示中でも押せます）。
- 右上のインジケーターは **オンライン（緑）/ 連携中（黄）/ オフライン（赤）** の 3 状態。
- 予定には必ず登録者が記録され、「〇〇が追加」と表示されます。
- ダッシュボード下部に「〇〇でログイン中 / ログアウト」。

## 4. いま仮になっている部分

| 項目 | 現状 | 本実装 |
| --- | --- | --- |
| 認証 | ユーザー選択＋パスワード（検証なし） | Firebase Authentication（メール／パスワード） |
| 予定データ | ブラウザの localStorage。タブ間は BroadcastChannel で同期 | Cloud Firestore（リアルタイム購読） |
| 家族情報 | `user/users.csv`（読めなければサンプル） | CSV のままでも、Firestore の `members` に移しても可 |
| 接続状態 | `navigator.onLine` と書き込み中フラグ | 同じ考え方＋ Firestore の `metadata.fromCache` |
| ロゴ | 同梱のプレースホルダ | `public/image/logo.png` を差し替えるだけ |

## 5. Firebase 本実装への移行

### 5-1. Firebase 側の準備

1. Firebase コンソールでプロジェクトを作成し、**Authentication → ログイン方法 → メール / パスワード** を有効化します。
2. **Authentication → ユーザー** で、CSV に書いた家族のメールアドレスとパスワードを 1 人ずつ登録します（「ユーザーを追加」）。
3. **Firestore Database** を作成します（本番モードでOK）。
4. プロジェクトの設定 → マイアプリ で Web アプリを追加し、設定値を控えます。

### 5-2. アプリ側

```bash
pnpm add firebase
cp .env.example .env.local   # 値を埋める
```

`src/data/firebase.ts` を新規作成:

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
```

`src/data/firebaseBackend.ts` の `createFirebaseBackend()` を、同じファイル冒頭のコメント（`signInWithEmailAndPassword` / `onSnapshot` / `writeBatch` の例）に沿って実装します。守るべき対応は次のとおりです。

| メソッド | Firebase での実装 |
| --- | --- |
| `listMembers` | CSV のままなら現状維持。Firestore にするなら `members` コレクションを `getDocs`。 |
| `signIn` | `signInWithEmailAndPassword(auth, member.email, password)` → `uid` を `userId` に。 |
| `restoreSession` | `onAuthStateChanged` の現在ユーザー、または `browserLocalPersistence`。 |
| `subscribePlans` | `onSnapshot(query(collection(db,'plans'), orderBy('date')))`。 |
| `createPlans` | 日付ごとに 1 ドキュメント。`writeBatch` でまとめて `set`。 |
| `deletePlan` | `deleteDoc(doc(db,'plans',id))`。 |
| `restorePlan` | `setDoc`（削除の取り消し用）。 |
| `subscribeConnection` | `navigator.onLine` ＋ 書き込み中フラグ ＋ `snapshot.metadata.fromCache`。 |

最後に `src/data/backend.ts` の 1 行を差し替えます。

```ts
// 変更前
export const backend: PlannerBackend = createMockBackend();

// 変更後
import { createFirebaseBackend } from './firebaseBackend';
import { firebaseConfig } from './firebaseConfig';
export const backend: PlannerBackend = createFirebaseBackend(firebaseConfig);
```

画面側（`src/screens/*`, `src/components/*`）は **一切変更不要** です。

### 5-3. Firestore セキュリティルール（家族以外を締め出す）

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /plans/{planId} {
      allow read, write: if request.auth != null;
    }
    match /members/{memberId} {
      allow read: if request.auth != null;
      allow write: if false;   // 家族の追加はコンソールから
    }
  }
}
```

`request.auth != null` が「Firebase の認証が通った人だけがサイト内に入れる」の実体です。ログインできない人は Firestore も読めません。アプリ側でも未認証時はログイン画面しか描画しません。

## 6. ビルドと公開

```bash
pnpm build        # dist/ に出力
```

**Firebase Hosting**（推奨。同梱の `firebase.json` がそのまま使えます）:

```bash
pnpm add -g firebase-tools
firebase login
firebase use --add          # 対象プロジェクトを選択（.firebaserc が作られます）
pnpm build
firebase deploy --only hosting
```

`firebase.json` はすべてのパスを `index.html` にリワイトし、`/assets/**` だけ長期キャッシュ、`index.html`・`sw.js`・`user/**` はキャッシュしない設定です。

> **GitHub Pages を使う場合**は、サイトがサブパス（`/repo-name/`）に置かれるため、`vite.config.ts` に `base: '/repo-name/'` を追加してください。Firebase Hosting はルート配信なので不要です。

## 7. GitHub への配置

1. GitHub で空のリポジトリを作成します（README は作らない）。
2. このフォルダで:

```bash
git init
git add .
git commit -m "Planner: 家族の予定管理アプリ"
git branch -M main
git remote add origin https://github.com/<あなたのアカウント>/<リポジトリ名>.git
git push -u origin main
```

3. `user/users.csv` と `public/image/logo.png` を差し替えて push すれば、次回のビルド／デプロイから反映されます。

`node_modules` と `dist` は `.gitignore` 済みです。`.env.local` も除外されます。

## 8. 調整したいときの入口

| 変えたいもの | 場所 |
| --- | --- |
| 色（ブランドカラー・紙の色・メンバー色） | `src/styles/tokens.css` |
| フォント | `index.html` の Google Fonts と `tokens.css` の `--font-sans` / `--font-display` |
| 余白・角丸・影 | `src/styles/tokens.css` |
| サンプル予定 | `src/data/seed.ts` |
| サンプル家族 | `src/data/family.ts` の `SAMPLE_FAMILY` |
| 文言 | 各 `src/screens/*.tsx` |
