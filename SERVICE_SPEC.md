# TalentMail - サービス仕様書

## 1. サービス概要
- **一言で**: マルチテナントメール配信SaaS（自社版Resend）
- **対象ユーザー**: AppTalentHub社内プロダクト + 将来的に外部ユーザー
- **解決する課題**: メール配信機能を各プロダクトに密結合させず、共通SaaSとして提供。組織ごとにプロバイダー・ドメイン・テンプレートを管理
- **ステータス**: Beta (v0.2.0)

## 2. ユーザーロールと権限
| ロール | できること |
|---|---|
| 組織Admin | 組織設定・メンバー招待・プロバイダー管理・ドメイン管理・APIキー管理 |
| 組織Member | テンプレート管理・メール送信・ログ閲覧・分析 |
| APIクライアント | APIキー経由でメール送信・テンプレート管理・ログ参照 |

## 3. 機能一覧
### 実装済み
- [x] Google OAuth認証 — ログイン/ログアウト/プロフィール
- [x] 組織管理 — 作成/選択/メンバー招待/ロール制御
- [x] マルチテナント — 全データが組織スコープ
- [x] メールプロバイダー — SMTP/SendGrid/SES対応、暗号化保存
- [x] ドメイン管理 — 登録/DNS TXT検証
- [x] 送信アドレス — 検証済みドメインのアドレス管理
- [x] テンプレートCRUD — `{{variable}}` プレースホルダー対応
- [x] メール送信API — テンプレート指定/直接HTML指定
- [x] テスト送信 — テンプレートのテスト送信
- [x] 配信ログ — 送信履歴のフィルタリング・一覧（組織スコープ）
- [x] 開封トラッキング — 1x1透明GIFピクセル
- [x] クリックトラッキング — リンク置換+302リダイレクト
- [x] 配信停止 — ランディングページ+処理（組織スコープ）
- [x] APIキー認証 — `tm_live_xxxx` 形式、組織紐付き
- [x] 統計API — 送信数・開封率・クリック率（組織スコープ）
- [x] Dashboard — 全機能のWebUI

- [x] 一斉配信（broadcast）— オーディエンス指定バッチ送信・スケジュール配信・クイック送信
- [x] コンタクト管理 — CRUD・CSV一括インポート・Google Workspace連携
- [x] オーディエンス管理 — 配信グループ作成・コンタクト割り当て
- [x] マーケティングメール配信停止フッター自動挿入
- [x] レート制限 — 送信間隔50ms・日次クォータ（プラン別上限）
- [x] Webhook通知 — email.sent / email.failed イベント

### 未実装（予定）
- [ ] 専用送信アドレス対応（mail-magazine@apptalenthub.co.jp）
- [ ] ダブルオプトイン（確認メール→正式登録）
- [ ] オプトイン登録フォーム（公開ページ）
- [ ] List-Unsubscribeヘッダー自動付与（RFC 8058 One-Click）
- [ ] オプトイン・オプトアウト履歴テーブル（監査証跡）
- [ ] マルチチャネル対応（LINE Messaging API等）

## 4. 画面一覧
| 画面 | パス | 対象ロール | 概要 |
|---|---|---|---|
| ログイン | `/login` | 未認証 | Google OAuthログイン |
| 組織選択 | `/orgs` | 全ユーザー | 組織選択/作成 |
| ダッシュボード | `/` | Member+ | 統計サマリー・クイックアクション |
| テンプレート一覧 | `/templates` | Member+ | テンプレートの管理 |
| テンプレート編集 | `/templates/:id` | Member+ | テンプレートの作成・編集・テスト送信 |
| 配信ログ | `/logs` | Member+ | 送信履歴の一覧・フィルタリング |
| 分析 | `/analytics` | Member+ | 送信統計のビジュアル表示 |
| 組織設定 | `/settings/org` | Admin | 組織情報・メンバー管理 |
| ドメイン | `/settings/domains` | Admin | ドメイン登録・DNS検証 |
| 送信アドレス | `/settings/addresses` | Admin | 送信アドレス管理 |
| プロバイダー | `/settings/providers` | Admin | メールプロバイダー設定 |
| APIキー | `/settings/keys` | Admin | APIキー発行・管理 |
| 配信停止 | `/unsubscribe/:token` | 公開 | 配信停止ランディングページ |

## 5. データモデル
### テーブル一覧
- `users` — Google OAuthユーザー（id, googleId, email, name, avatarUrl）
- `sessions` — ログインセッション（id, userId, expiresAt）
- `organizations` — 組織（id, name, slug, plan）
- `org_members` — 組織メンバー（orgId, userId, role: admin/member）
- `org_invitations` — 招待（token, email, orgId, role, expiresAt）
- `domains` — 登録ドメイン（orgId, domain, status, verificationToken）
- `sending_addresses` — 送信アドレス（orgId, domainId, address, displayName）
- `email_providers` — プロバイダー設定（orgId, type, config暗号化, isDefault）
- `api_keys` — APIキー（orgId, keyHash, scopes, createdBy）
- `templates` — テンプレート（orgId, name, subject, bodyHtml, variables）
- `email_logs` — 配信ログ（orgId, templateId, toAddress, status, openedAt, clickedAt）
- `unsubscribes` — 配信停止（orgId, email, reason, source）
- `contacts` — 配信先（orgId, email, name）※Phase 3
- `audiences` — 配信グループ（orgId, name）※Phase 3

## 6. 外部連携
- 認証: Google OAuth 2.0
- DB: PostgreSQL (Cloud SQL)
- メール送信: SMTP / SendGrid / Amazon SES（組織ごとに設定）
- ホスティング: Cloud Run
- SDK: @apptalenthub/talentmail

## 7. ビジネスルール
- APIキーは `tm_live_` プレフィックス。ハッシュのみDB保存。組織スコープ
- テンプレートの `{{variable}}` はメール送信時に展開
- プロバイダー設定はAES-256-GCMで暗号化してDB保存
- ドメインはDNS TXTレコード (_talentmail.domain) で検証
- 送信アドレスは検証済みドメインに属するもののみ登録可
- 配信停止トークンは `orgId:email` のbase64urlエンコード
- セッションは30日有効、Cookie HttpOnly

## 8. 非機能要件
- 想定ユーザー数: 初期は社内数件 → SaaS化後は数十組織
- パフォーマンス目標: 単発送信 < 3秒
- セキュリティ: OAuth認証、APIキー認証、プロバイダー設定暗号化
- デプロイ: Cloud Run (ステートレス) + Cloud SQL (PostgreSQL)

## 9. 既知の課題・制限
- 一斉配信のキュー処理は未実装
- レート制限は未実装
- ドメインのSPF/DKIM設定ガイドは手動案内

## 10. 更新履歴
| 日付 | 内容 |
|---|---|
| 2026-03-04 | 初版作成（Phase 1 MVP） |
| 2026-03-07 | マルチテナントSaaS化（v0.2.0）Google OAuth、組織管理、プロバイダー抽象化、PostgreSQL移行 |
