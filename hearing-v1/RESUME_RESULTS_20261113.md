# V1.0 再開実測記録（2026-11-13 JST）

## 保全
- 引継ぎGitHub HEAD: 1afc56486326e3e4cc14b86d5d738213bad869a2
- main確認値: d65ebe1d54e96215ca64635ffc6242eee0be6af1
- main・公式サイト・既存Cloudflare Pages設定への変更なし。

## 公開済み
- URL: https://alopex-concierge-hearing-v1.smart-drake-4743.chatgpt.site
- 既存の独立Sites環境を使用。Cloudflare Pages新規公開ではない。
- project_id: appgprj_6af6e12a4638819196bf63fb1f3c058a
- source commit: 0ec5785e03b92837bff41abd1e16c87f61572452
- deployment: appgdep_6af6e6e185e881918a28419b598a7553
- status: succeeded
- アクセス設定: custom、owner 1名のみ、外部閲覧者0名。
- 未認証curl: HTTP 401。ブラウザではログイン画面表示。
- 代表アカウントのChatGPTログイン後、回答画面を表示できた。

## 実測済み
- Node自動テスト15/15通過。Google保存のテストは依然として模擬。
- PC viewport: 1408px、document scrollWidth:1393px。横はみ出しなし。
- 基本情報の必須3問未回答で次へ進めず、エラーを表示。
- テスト会社・担当・example.comメールを入力し、再読み込み後に会社名を復元確認。
- デザイン6見本をPCで表示確認。
- 写真調達3種類を同時に選択でき、S09Q01〜S09Q12の質問を表示確認。
- 初期表示135問は条件分岐適用後の数。定義は162問・16分野。

## Google準備済み・本人承認待ち
- Apps Script: https://script.google.com/home/projects/1Xvy2eY6GQ6ljCzZwPmclslY5En6asOB0tJQrZ4IaeXzl1UIm0VTsf7h1/edit
- 名称: ALOPEX WEB CONCIERGE｜ヒアリング V1.0 検収
- 空のmyFunctionプロジェクトへ既存Code.gsとSchema.gsを結合配置し保存。
- setup実行で初回権限承認を要求。「このアプリは Google で確認されていません」の画面に到達。
- 承認操作は未実施。シート作成、RECEIVER_SECRET、Webアプリデプロイ、GAS_URL/GAS_SECRET設定、実保存・重複再送テストは未完了。
- 秘密値をフロント・Gitへ登録していない。未接続時は503で送信失敗する設計。

## 未完了
- Google本人承認後の連携と実保存・読み戻し・再送検証。
- スマホ画面検収。390×844のviewport設定要求が実画面へ反映されず、実幅1408pxのままだったため未検証。
- PC全16分野の網羅操作と送信完了画面検証。
- クライアント向け本番運用は開始していない。

## 停止手段
- 現在Google保存先未接続のため実回答受付不可。
- サイトは代表ownerのみ閲覧可能。公開範囲を拡大しない。
- 連携後の受付停止はGAS_SECRET削除またはGASデプロイのアーカイブ。これら停止復旧操作の実測は未実施。
