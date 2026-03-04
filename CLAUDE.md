# CLAUDE.md — TalentMail

## Overview
独立型メール配信マイクロサービス（自社版Resend）。テンプレート管理・配信ログ・開封/クリック追跡・配信停止管理を内蔵。TalentFlow、GrantHub等からAPIで利用可能。

## Tech Stack
- API: Hono 4.x + Node.js 22
- DB: SQLite (better-sqlite3) + Drizzle ORM
- メール送信: Nodemailer (Google Workspace SMTP)
- Dashboard: React 19 + Vite + Tailwind CSS v4
- バリデーション: Zod
- monorepo: npm workspaces

## Commands
```bash
# ルートから
npm install                    # 全パッケージの依存インストール
npm run dev                    # API + Dashboard同時起動
npm run dev:api                # APIのみ起動 (port 3456)
npm run dev:dashboard          # Dashboardのみ起動 (port 5173)

# API
cd packages/api
npm run dev                    # 開発サーバー (tsx watch)
npm run build                  # TypeScriptビルド
npm run db:generate            # Drizzle migration生成
npm run db:migrate             # migration実行

# Dashboard
cd packages/dashboard
npm run dev                    # Vite dev server
npm run build                  # プロダクションビルド
```

## Architecture
```
packages/
├── api/src/
│   ├── index.ts          # エントリーポイント (Hono + @hono/node-server)
│   ├── app.ts            # ルート定義・ミドルウェア
│   ├── config.ts         # 環境変数
│   ├── db/
│   │   ├── schema.ts     # Drizzle ORMスキーマ
│   │   ├── client.ts     # DB接続 (better-sqlite3)
│   │   └── init.ts       # テーブル初期化
│   ├── routes/           # APIエンドポイント
│   ├── middleware/auth.ts # APIキー認証
│   ├── services/         # ビジネスロジック
│   └── utils/id.ts       # ID・APIキー生成
├── dashboard/src/        # React SPA
└── sdk/src/              # クライアントSDK (@apptalenthub/talentmail)
```

## API Authentication
- `Authorization: Bearer tm_live_xxxx` ヘッダー
- トラッキング・配信停止エンドポイントは認証不要

## Environment Variables
`.env.example` 参照。SMTP認証はGoogle Workspace App Password使用。

## Database
SQLiteファイル (`./data/talentmail.db`)。起動時に自動テーブル作成。
