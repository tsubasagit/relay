# CLAUDE.md — TalentMail

## Overview
マルチテナントメール配信SaaS（自社版Resend）。Google OAuth認証、組織管理、ドメイン登録、複数メールプロバイダー対応。テンプレート管理・配信ログ・開封/クリック追跡・配信停止管理を内蔵。

## Tech Stack
- API: Hono 4.x + Node.js 22
- DB: PostgreSQL + Drizzle ORM
- 認証: Google OAuth 2.0 + Session Cookie
- メール送信: Nodemailer (SMTP) / SendGrid / Amazon SES
- 暗号化: AES-256-GCM (プロバイダー設定)
- Dashboard: React 19 + Vite + Tailwind CSS v4
- バリデーション: Zod
- monorepo: npm workspaces
- デプロイ: Cloud Run + Cloud SQL

## Commands
```bash
# ルートから
npm install                    # 全パッケージの依存インストール
npm run dev                    # API + Dashboard同時起動
npm run dev:api                # APIのみ起動 (port 3456)
npm run dev:dashboard          # Dashboardのみ起動 (port 5173)

# ローカル開発 (PostgreSQL)
docker compose up postgres -d  # PostgreSQLのみ起動
npm run dev:api                # APIサーバー起動

# API
cd packages/api
npm run dev                    # 開発サーバー (tsx watch)
npm run build                  # TypeScriptビルド
npm run db:generate            # Drizzle migration生成
npm run db:migrate             # migration実行
npm run db:seed                # 初期データ投入

# Dashboard
cd packages/dashboard
npm run dev                    # Vite dev server
npm run build                  # プロダクションビルド
```

## Architecture
```
packages/
├── api/src/
│   ├── index.ts              # エントリーポイント (Hono + @hono/node-server)
│   ├── app.ts                # ルート定義・ミドルウェア
│   ├── config.ts             # 環境変数
│   ├── db/
│   │   ├── schema.ts         # Drizzle ORMスキーマ (PostgreSQL)
│   │   ├── client.ts         # DB接続 (postgres.js)
│   │   ├── init.ts           # テーブル初期化
│   │   └── seed.ts           # 初期データ投入
│   ├── routes/
│   │   ├── auth.ts           # Google OAuth (login/callback/me/logout)
│   │   ├── orgs.ts           # 組織管理・メンバー招待
│   │   ├── invitations.ts    # 招待受諾
│   │   ├── templates.ts      # テンプレートCRUD
│   │   ├── emails.ts         # メール送信
│   │   ├── logs.ts           # 配信ログ・統計
│   │   ├── keys.ts           # APIキー管理
│   │   ├── providers.ts      # メールプロバイダー設定
│   │   ├── domains.ts        # ドメイン登録・DNS検証
│   │   ├── sending-addresses.ts # 送信アドレス管理
│   │   ├── tracking.ts       # 開封/クリックトラッキング
│   │   └── unsubscribe.ts    # 配信停止
│   ├── middleware/
│   │   ├── combined-auth.ts  # 統合認証 (Session or APIキー)
│   │   ├── session.ts        # Session認証
│   │   └── requireRole.ts    # ロール制御
│   ├── services/
│   │   ├── google-auth.ts    # Google OAuth
│   │   ├── mailer.ts         # メール送信 (プロバイダーファクトリー経由)
│   │   ├── template.ts       # テンプレート変数展開
│   │   └── providers/        # メールプロバイダー実装
│   │       ├── types.ts      # EmailProvider インターフェース
│   │       ├── smtp.ts       # SMTP (Nodemailer)
│   │       ├── sendgrid.ts   # SendGrid
│   │       ├── ses.ts        # Amazon SES
│   │       └── factory.ts    # プロバイダーファクトリー
│   └── utils/
│       ├── id.ts             # ID・APIキー生成
│       └── crypto.ts         # AES-256-GCM暗号化
├── dashboard/src/
│   ├── components/
│   │   ├── AuthProvider.tsx  # 認証コンテキスト
│   │   ├── OrgSelector.tsx   # 組織切替ドロップダウン
│   │   ├── Layout.tsx        # メインレイアウト
│   │   └── Sidebar.tsx       # サイドナビゲーション
│   ├── hooks/useAuth.ts      # 認証フック
│   ├── lib/api.ts            # API クライアント (Cookie認証 + X-Org-Id)
│   └── pages/                # ページコンポーネント
└── sdk/src/                  # クライアントSDK (@apptalenthub/talentmail)
```

## Authentication
### Dashboard: Google OAuth
1. `/auth/google` → Google OAuth画面へリダイレクト
2. `/auth/google/callback` → ユーザー自動登録 + セッション作成
3. Cookie `talentmail_session` で認証
4. `X-Org-Id` ヘッダーで組織コンテキスト指定

### SDK/API: APIキー
- `Authorization: Bearer tm_live_xxxx` ヘッダー
- APIキーに `orgId` 紐付き → 自動的に組織スコープ

## Environment Variables
```
DATABASE_URL=postgres://talentmail:talentmail@localhost:5432/talentmail
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3456/auth/google/callback
SESSION_SECRET=random-secret
ENCRYPTION_KEY=64-char-hex-string
API_PORT=3456
API_BASE_URL=http://localhost:3456
```

## Database
PostgreSQL。起動時に自動テーブル作成 (`db/init.ts`)。
Drizzle migrationは `npm run db:generate` → `npm run db:migrate`。
