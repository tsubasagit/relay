# TalentMail - サービス仕様書

## 1. サービス概要
- **一言で**: OSSメール配信マイクロサービス（自社版Resend）
- **対象ユーザー**: AppTalentHub社内プロダクト（TalentFlow, GrantHub等）
- **解決する課題**: メール配信機能を各プロダクトに密結合させず、共通APIとして提供
- **ステータス**: MVP

## 2. ユーザーロールと権限
| ロール | できること |
|---|---|
| APIクライアント | APIキーを使ってメール送信・テンプレート管理・ログ参照 |
| Dashboard管理者 | WebUIでテンプレート管理・ログ閲覧・分析・APIキー管理 |

## 3. 機能一覧
### 実装済み
- [x] テンプレートCRUD — `{{variable}}` プレースホルダー対応
- [x] メール送信API — テンプレート指定/直接HTML指定
- [x] テスト送信 — テンプレートのテスト送信
- [x] 配信ログ — 送信履歴のフィルタリング・一覧
- [x] 開封トラッキング — 1x1透明GIFピクセル
- [x] クリックトラッキング — リンク置換+302リダイレクト
- [x] 配信停止 — ランディングページ+処理API
- [x] APIキー認証 — `tm_live_xxxx` 形式、SHA-256ハッシュ保存
- [x] 統計API — 送信数・開封率・クリック率
- [x] Dashboard — テンプレート管理・ログ・分析・設定

### 未実装（予定）
- [ ] 一斉配信（broadcast）— オーディエンスへのバッチ送信
- [ ] コンタクト管理 — CSV一括インポート
- [ ] オーディエンス管理 — 配信グループ
- [ ] List-Unsubscribeヘッダー自動付与
- [ ] マーケティングメール配信停止フッター自動挿入
- [ ] レート制限ミドルウェア
- [ ] Cloud Runデプロイ

## 4. 画面一覧
| 画面 | パス | 概要 |
|---|---|---|
| ダッシュボード | `/` | 統計サマリー・クイックアクション |
| テンプレート一覧 | `/templates` | テンプレートの管理 |
| テンプレート編集 | `/templates/:id` | テンプレートの作成・編集・テスト送信 |
| 配信ログ | `/logs` | 送信履歴の一覧・フィルタリング |
| 分析 | `/analytics` | 送信統計のビジュアル表示 |
| 設定 | `/settings` | APIキーの設定・作成・管理 |
| 配信停止 | `/unsubscribe/:token` | 配信停止ランディングページ |

## 5. データモデル
### テーブル一覧
- `api_keys` — APIキー認証用（id, name, keyHash, keyPrefix, scopes, isActive, createdAt）
- `templates` — メールテンプレート（id, name, subject, bodyHtml, bodyText, variables, category, isActive）
- `email_logs` — 配信ログ（id, templateId, toAddress, subject, status, openedAt, clickedAt, sentAt）
- `unsubscribes` — 配信停止リスト（id, email, reason, source）
- `contacts` — 配信先（id, email, name, metadata）※Phase 3で利用
- `audiences` — 配信グループ（id, name, contactCount）※Phase 3で利用
- `audience_contacts` — 中間テーブル ※Phase 3で利用

## 6. 外部連携
- メール送信: Google Workspace SMTP（Nodemailer）
- DB: SQLite（better-sqlite3）
- ホスティング: Cloud Run（API）+ Firebase Hosting（Dashboard）※予定

## 7. ビジネスルール
- APIキーは `tm_live_` プレフィックス。ハッシュのみDB保存
- テンプレートの `{{variable}}` はメール送信時に展開
- 開封トラッキングはHTML内に1x1 GIFを挿入して検知
- クリックトラッキングはリンクURLをトラッキングURL経由に置換
- 配信停止トークンはメールアドレスのbase64urlエンコード

## 8. 非機能要件
- 想定ユーザー数: 社内プロダクト数件
- パフォーマンス目標: 単発送信 < 3秒
- セキュリティ: APIキー認証、SMTP認証

## 9. 既知の課題・制限
- 一斉配信のキュー処理は未実装（Phase 3）
- レート制限は未実装（Phase 4）
- SQLiteのため同時書き込みに制約あり（WALモードで軽減）

## 10. 更新履歴
| 日付 | 内容 |
|---|---|
| 2026-03-04 | 初版作成（Phase 1 MVP） |
