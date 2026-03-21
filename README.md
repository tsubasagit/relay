# Relay

**Developer-friendly email delivery platform.**
SendGridの代替、Resendのオープンな競合。

## What is Relay?

Relay は、開発者とビジネスのためのメール配信プラットフォームです。SendGrid が無料プランを廃止する中、シンプルで手頃な価格のメール配信を提供します。

### Why Relay?

- **SendGrid からの移行が簡単** - SMTP / API どちらでも接続可能
- **マルチテナント対応** - 1つのインスタンスで複数組織を管理
- **コンタクト管理** - CSV / Google Workspace からインポート
- **一斉配信** - オーディエンス（リスト）を作って一括送信
- **テンプレートエンジン** - `{{variables}}` でパーソナライズ
- **配信停止管理** - ワンクリック配信停止リンク自動挿入
- **開封・クリック追跡** - トラッキングピクセル & リダイレクト
- **セルフホスト可能** - Docker Compose で即座に起動

## Tech Stack

| Layer | Technology |
|---|---|
| API | Hono + Node.js |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | Drizzle |
| Dashboard | React 19 + Vite + Tailwind CSS v4 |
| Auth | Google OAuth 2.0 |
| Email | SMTP (Nodemailer) / SendGrid / Amazon SES |
| Deploy | Docker / Cloud Run |

## Quick Start

```bash
# Install
git clone https://github.com/tsubasagit/relay.git
cd relay
npm install

# Start dev servers (API: 3456, Dashboard: 5173)
npm run dev
```

### Environment Variables

```bash
# packages/api/.env
DATABASE_PATH=./data/relay.db
API_PORT=3456
API_BASE_URL=http://localhost:3456
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_CALLBACK_URL=http://localhost:3456/auth/google/callback
SESSION_SECRET=change-this-in-production
ENCRYPTION_KEY=64-char-hex-string
```

## Features

### Email Sending
- Single email via API or dashboard
- Bulk broadcast to audience lists
- Template-based with variable substitution
- Multiple provider support (SMTP, SendGrid, SES)

### Contact Management
- Manual add / edit / delete
- CSV bulk import
- Google Workspace directory import
- Unsubscribe status tracking

### Audiences
- Create named lists (e.g., "Newsletter subscribers")
- Add/remove contacts with search
- Use as broadcast targets

### Broadcasts
- Select audience + template + sending address
- Background async processing (non-blocking)
- Real-time progress tracking (polling)
- Automatic unsubscribe link injection
- Rate-limited sending (50ms interval)
- Skip unsubscribed contacts

### Analytics
- Delivery logs with status filtering
- Open rate / click rate tracking
- Per-broadcast detailed stats

### Organization Management
- Multi-tenant with role-based access (admin/member)
- Domain verification via DNS TXT record
- API key management (`rl_live_` prefix)
- Provider config encryption (AES-256-GCM)

## API

```bash
# Send email
curl -X POST http://localhost:3456/api/emails/send \
  -H "Authorization: Bearer rl_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Hello","html":"<p>Hi!</p>"}'
```

### SDK

```typescript
import { RelayClient } from "@relay-email/sdk";

const relay = new RelayClient({
  baseUrl: "https://your-relay-instance.com",
  apiKey: "rl_live_xxxxx",
});

await relay.sendEmail({
  to: "user@example.com",
  templateId: "tmpl_xxxx",
  variables: { name: "John" },
});
```

## License

MIT
