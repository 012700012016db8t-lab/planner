# Planner — 家族の予定をひとつの場所に

家族だけが使う予定管理 Web アプリです。今日と明日の予定、月のカレンダー、複数日にまたがる一括登録、対象者の複数選択、登録者の記録までを、スマートフォン中心の UI でまとめています。ホーム画面に追加すればアプリのように起動できます（PWA）。

**Firebase 実装済み**です。ログインは Firebase Authentication（メール／パスワード）、予定は Cloud Firestore に保存され、認証済みの家族全員が同じ予定をリアルタイムで見られます。

---

## 1. まず動かす

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

`src/data/firebaseConfig.ts` に Firebase の設定が入っているので、追加の環境変数なしで動きます。

## 2. リポジトリに置くファイル配置

zip の中身を **そのまま GitHub リポジトリの直下** に置いてください。

```
（リポジトリ直下）
├── image/
│   └── logo.png                ← ロゴ原本。差し替えるならここ
├── user/
│   └── users.csv               ← 家族の一覧（ここを編集する）
├── public/
│   ├── image/logo.png          ← ビルド時に image/logo.png から自動コピー
│   ├── user/users.csv          ← ビルド時に user/users.csv から自動コピー
│   ├── manifest.webmanifest
│   └── sw.js
├── scripts/sync-assets.mjs     ← 上記の自動コピー
├── src/                        ← アプリ本体（app / components / data / lib / screens / styles）
├── firebase.json               ← Hosting + Firestore の設定
├── firestore.rules             ← ★セキュリティルール（下で解説）
├── firestore.indexes.json
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig*.json
└── vite.config.ts
```

普段さわるのは **`image/logo.png`** と **`user/users.csv`** の 2 つだけです。

## 3. Firebase 側の初期セットアップ

プロジェクト `planner-267b2` を使う前提です。

### 3-1. 家族のアカウントを作る

Firebase コンソール → **Authentication** → **Users** → 「ユーザーを追加」で、家族のメールアドレスとパスワードを 1 人ずつ登録します。

> ここで登録するメールアドレスは、`user/users.csv` に書くメールアドレスと **完全に一致** させてください。ログイン画面でユーザー名を選ぶと、そのメールアドレスで Firebase にサインインします。

### 3-2. Firestore データベースを作る

**Firestore Database** → 「データベースを作成」→ 本番モード → ロケーションを選択（例: `asia-northeast1`）。

### 3-3. ルールを適用する

**Firestore Database** → **ルール** タブを開き、中身を `firestore.rules` の全文に置き換えて「公開」します。

または CLI で:

```bash
pnpm dlx firebase-tools login
pnpm dlx firebase-tools use planner-267b2
pnpm dlx firebase-tools deploy --only firestore:rules
```

## 4. セキュリティルール（ここが「家族以外は閲覧不可」の実体）

`firestore.rules` に次の内容が入っています。**丸ごとコピーしてコンソールに貼ればOK**です。

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function validPlan() {
      let d = request.resource.data;
      return d.title is string
        && d.title.size() >= 1
        && d.title.size() <= 60
        && d.date is string
        && d.date.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && d.groupId is string
        && d.memberIds is list
        && d.memberIds.size() >= 1
        && d.memberIds.size() <= 20
        && d.createdById is string
        && d.createdById.size() >= 1
        && d.createdByName is string
        && d.createdByName.size() >= 1
        && d.createdAt is int
        && (!('startTime' in d) || d.startTime == null
            || (d.startTime is string && d.startTime.matches('^[0-9]{2}:[0-9]{2}$')))
        && (!('endTime' in d) || d.endTime == null
            || (d.endTime is string && d.endTime.matches('^[0-9]{2}:[0-9]{2}$')));
    }

    match /plans/{planId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && validPlan();
      allow update: if isSignedIn() && validPlan();
      allow delete: if isSignedIn();
    }

    match /members/{memberId} {
      allow read: if isSignedIn();
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

読み解き方:

| 行 | 意味 |
| --- | --- |
| `allow read: if isSignedIn()` | **ログインしていない人は予定を 1 件も読めません。** アプリ側でログイン画面しか出さないのは見た目の制御で、本当の鍵はここです。 |
| `validPlan()` | 予定の形をサーバー側でも検証（名称 1〜60 文字、日付形式、対象者 1 人以上、時刻形式など）。壊れたデータや想定外の書き込みを弾きます。 |
| `match /{document=**} { allow read, write: if false }` | 上のどれにも当てはまらないパスは全拒否。将来コレクションを増やしたときの取りこぼし防止です。 |

**さらに家族を限定したい場合**（Firebase Authentication に別の人が追加されてしまった場合など）は、`isSignedIn()` を次のように変えると、指定したメールアドレスだけに絞れます。

```
function isFamily() {
  return request.auth != null
    && request.auth.token.email in [
      'papa@example.com',
      'mama@example.com',
      'haruto@example.com',
      'mio@example.com'
    ];
}
```

そのうえで `isSignedIn()` を `isFamily()` に置き換えてください（`request.auth.token.email_verified == true` を足すとさらに厳密になります）。

## 5. ロゴと家族 CSV の差し替え

### ロゴ

**`image/logo.png`** を置き換えるだけです。`pnpm dev` / `pnpm build` のたびに `public/image/logo.png` へ自動コピーされ、ヘッダー左上・ログイン画面・タブアイコン・ホーム画面アイコン（PWA）が一斉に変わります。

- 推奨: 512 × 512 px の正方形 PNG。
- ホーム画面アイコンでは端が少し欠けることがあるので、図柄の周囲に 10% 程度の余白があると安全です。

### 家族の CSV

**`user/users.csv`** を編集します（ビルド時に `public/user/users.csv` へ自動コピー）。

```csv
"お父さん";"papa@example.com"
"お母さん";"mama@example.com"
"はると";"haruto@example.com"
"みお";"mio@example.com"
```

- 区切りは `;` と `,` の両方を自動判定。BOM・CRLF・空行・`#` コメント行も無視します。
- 1 行目がヘッダー（`name` など）なら読み飛ばします。
- ファイル名は `users.csv` のほか `family.csv` / `members.csv` でも読み込みます。
- メールアドレスは Firebase Authentication のログインメールと一致させてください。

## 6. デプロイ

```bash
pnpm build
pnpm dlx firebase-tools deploy --only hosting
```

`firebase.json` に SPA リワイト（すべて `index.html` へ）とキャッシュ設定を入れてあるので、`/day/2026-11-12` のような URL を直接開いても動きます。

## 7. 画面と機能

| 画面 | できること |
| --- | --- |
| ログイン | CSV の家族一覧から選択 → パスワード入力 → Firebase 認証。未認証では他画面に入れません。 |
| ダッシュボード | 上から「今日の予定」「明日の予定」「月のカレンダー」。カレンダーの日付をタップで日別シート。 |
| 日別シート | その日の予定一覧、削除（取り消し可）、その日への追加。 |
| 新規予定 | 名称、任意の時間帯、カレンダーで複数日選択、対象者を複数選択（必須）。 |

共通:

- 左上のロゴは常時表示。タップでダッシュボードに戻ります（シート表示中でも押せます）。
- 右上のインジケーターは **オンライン（緑）/ 連携中（黄）/ オフライン（赤）**。Firestore の書き込み中と、キャッシュからの読み込み中が「連携中」です。
- 予定には登録者が記録され、「〇〇が追加」と表示されます。
- ダッシュボード下部に「〇〇でログイン中 / ログアウト」。

## 8. Firestore のデータ構造

`plans` コレクションに、**日付ごとに 1 ドキュメント** を作ります（複数日を一括登録すると、同じ `groupId` を持つ複数ドキュメントになります）。

```jsonc
{
  "title": "小学校の運動会",
  "date": "2026-11-12",          // ローカル時間の YYYY-MM-DD
  "startTime": "09:00",           // 空欄なら null（終日）
  "endTime": "12:00",             // 空欄なら null
  "memberIds": ["papa", "haruto"],// 対象者（user/users.csv の id）
  "groupId": "g_m3k2_ab12cd",     // 一括登録のまとまり
  "createdById": "firebase-uid",  // 登録者の Firebase UID
  "createdByName": "お父さん",     // 登録者の表示名
  "createdAt": 1762900000000      // 登録時刻（ミリ秒）
}
```

`orderBy('date')` だけで購読し、同日の並び順はアプリ側で整えています。**複合インデックスは不要**です。

## 9. カスタマイズの入口

| 変えたいもの | 場所 |
| --- | --- |
| 色（ブランドカラー・紙の色・メンバー色） | `src/styles/tokens.css` |
| フォント | `index.html` の Google Fonts と `tokens.css` の `--font-sans` / `--font-display` |
| Firebase の設定値 | `src/data/firebaseConfig.ts`（または `.env.local` の `VITE_FIREBASE_*`） |
| 家族のサンプル | `src/data/family.ts` の `SAMPLE_FAMILY` |
| 文言 | 各 `src/screens/*.tsx` |
| 通信なしで画面だけ試す | `src/data/backend.ts` の 1 行を `createMockBackend()` に変更 |

## 10. 困ったとき

| 症状 | 原因と対処 |
| --- | --- |
| 「メールアドレスまたはパスワードが違います」 | Firebase Authentication にそのメールのユーザーが無い／パスワード違い。CSV のメールと Users のメールを一致させてください。 |
| 「Firebase で『メール / パスワード』のログインが有効になっていません」 | Authentication → ログイン方法 → メール / パスワード を有効化。 |
| 「予定を読み込めませんでした」 | Firestore のルール未適用、またはデータベース未作成。3-2 と 3-3 を確認。 |
| 「このドメインは Firebase の承認済みドメインに含まれていません」 | Authentication → 設定 → 承認済みドメイン に公開ドメインを追加。 |
| 予定が他の端末に出てこない | 同じ Firebase プロジェクトを見ているか、ログインしているかを確認。 |
