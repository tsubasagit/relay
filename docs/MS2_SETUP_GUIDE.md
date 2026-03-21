# MS2: 専用送信アドレス セットアップガイド

`mail-magazine@apptalenthub.co.jp` からメール送信するための設定手順。

## Step 1: Xserver でメールアカウント作成

1. Xserver サーバーパネルにログイン
2. **メールアカウント設定** → `apptalenthub.co.jp` を選択
3. **メールアカウント追加**:
   - アカウント: `mail-magazine`
   - パスワード: 強力なパスワードを設定（後でSMTP設定に使用）
   - 容量: 1000MB（目安）
4. 作成後、以下をメモ:
   - SMTP ホスト: `sv*****.xserver.jp`（サーバー情報から確認）
   - SMTP ポート: `465`（SSL）または `587`（STARTTLS）
   - ユーザー: `mail-magazine@apptalenthub.co.jp`
   - パスワード: 上記で設定したもの

## Step 2: DNS 設定（SPF / DKIM）

### SPF（Xserver はデフォルトで設定済みの場合あり）

Xserver サーバーパネル → **DNSレコード設定** で確認:

```
種別: TXT
ホスト名: apptalenthub.co.jp
内容: v=spf1 +a +mx include:sv*****.xserver.jp ~all
```

既に設定されている場合はそのままでOK。

### DKIM（Xserver は自動設定）

Xserver はサーバー側でDKIM署名を自動的に行う。
サーバーパネル → **メール** → **DKIM設定** で有効化を確認。

### TalentMail ドメイン検証用 TXT レコード

TalentMail Dashboard でドメイン登録後に表示される値を設定:

```
種別: TXT
ホスト名: _relay.apptalenthub.co.jp
内容: relay-verify-xxxxx（Dashboard で表示される値）
```

## Step 3: TalentMail Dashboard での設定

### 3-1. ドメイン登録

1. Dashboard → **設定** → **ドメイン**
2. `apptalenthub.co.jp` を追加
3. 表示されるDNS TXTレコード値をStep 2の手順でXserver DNSに設定
4. DNS反映後（最大24時間、通常数分）、**検証** ボタンをクリック

### 3-2. SMTPプロバイダー登録

1. Dashboard → **設定** → **プロバイダー**
2. **追加** → SMTP を選択
3. 以下を入力:
   - 名前: `Xserver SMTP`
   - ホスト: `sv*****.xserver.jp`
   - ポート: `465`
   - ユーザー: `mail-magazine@apptalenthub.co.jp`
   - パスワード: Step 1 で設定したもの
   - SSL: 有効
4. **デフォルトに設定** をオン
5. **接続テスト** で確認

### 3-3. 送信アドレス登録

1. Dashboard → **設定** → **送信アドレス**
2. **追加**:
   - メールアドレス: `mail-magazine@apptalenthub.co.jp`
   - 表示名: `AppTalentHub`
   - Reply-To: `tsubasa.miyazaki@apptalenthub.co.jp`（任意 — 返信先を個人にしたい場合）

### 3-4. テスト送信

1. Dashboard → **テンプレート** → 任意のテンプレートを開く
2. **テスト送信** で自分のアドレスに送信
3. 確認項目:
   - From が `AppTalentHub <mail-magazine@apptalenthub.co.jp>` と表示されること
   - 迷惑メールフォルダに入らないこと
   - Reply-To が正しく動作すること（返信先の確認）

## チェックリスト

- [ ] Xserver でメールアカウント `mail-magazine@apptalenthub.co.jp` 作成
- [ ] SPF レコード確認
- [ ] DKIM 有効化確認
- [ ] TalentMail でドメイン `apptalenthub.co.jp` 登録 → DNS TXT 設定 → 検証通過
- [ ] SMTP プロバイダー追加・接続テスト成功
- [ ] 送信アドレス `mail-magazine@apptalenthub.co.jp` 登録
- [ ] テスト送信 → 受信確認（迷惑メールに入らない）
- [ ] Broadcast で `mail-magazine@apptalenthub.co.jp` を選択して一括配信テスト
