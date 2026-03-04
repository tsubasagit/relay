# TalentMail

独立型メール配信マイクロサービス。テンプレート管理・配信ログ・開封/クリック追跡・配信停止管理を内蔵したAPI + ダッシュボード。

## セットアップ

```bash
# 依存インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集してSMTP設定を記入

# 開発サーバー起動
npm run dev
```

- API: http://localhost:3456
- Dashboard: http://localhost:5173

## 初回セットアップ

1. APIサーバー起動後、APIキーを作成:

```bash
curl -X POST http://localhost:3456/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "Dashboard用"}'
```

※初回のAPIキー作成は認証不要（キーが1つも存在しない場合）。実運用では最初のキーをCLIで作成してください。

2. 返ってきたAPIキーをDashboardの設定画面で入力

## API

認証: `Authorization: Bearer tm_live_xxxx`

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/emails/send` | メール送信 |
| CRUD | `/api/templates` | テンプレート管理 |
| POST | `/api/templates/:id/test` | テスト送信 |
| GET | `/api/logs` | 配信ログ |
| GET | `/api/logs/stats` | 統計 |
| CRUD | `/api/keys` | APIキー管理 |
| GET | `/api/health` | ヘルスチェック |

## SDK

```typescript
import { TalentMailClient } from "@apptalenthub/talentmail";

const mail = new TalentMailClient({
  baseUrl: "http://localhost:3456",
  apiKey: "tm_live_xxxx",
});

await mail.sendEmail({
  to: "user@example.com",
  templateId: "tmpl_xxx",
  variables: { name: "太郎" },
});
```

## ライセンス

MIT
