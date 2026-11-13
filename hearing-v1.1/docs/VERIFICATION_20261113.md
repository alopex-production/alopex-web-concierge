# V1.1 準備・実測記録

2026-11-13 JST。正式運用・顧客公開は未承認。

## 環境
- GitHub branch: work/hearing-v1.1-20261113
- V1.1確認URL: https://alopex-concierge-hearing-v11-review.smart-drake-4743.chatgpt.site
- 運用確認: https://alopex-concierge-hearing-v11-review.smart-drake-4743.chatgpt.site/ops
- Sites project: appgprj_6af6f4a94e088191b2995878ff68d6a6
- 配信runtime source commit:d9b6d96f26e00234fd2ecc3d53c349cf2a4ea9d9
- 配信version:appgprj_6af6f4a94e088191b2995878ff68d6a6~appgver_3697d32ccdf0819180b4a56fd27cf791
- 配信deployment:appgdep_6af6f99f24a08191832eae675bacdebb（succeeded、env revision4）。その後のGitHub側追加は検収記録・削除計画テストのみでruntime変更なし。
- ownerのみ・顧客未招待、reviewモード、CLIENT_RELEASE_APPROVED=false。
- V1.0のSite・GASコード・Google列構成・schemaVersion1.0.0・162問は変更なし。
- main保全値 d65ebe1d54e96215ca64635ffc6242eee0be6af1。
- V1.0作業ブランチ保全値 545c6e77453388afae6869a94d45f8dbecd41d4e。

## 自動テスト
- V1.1アクセス制御・受信互換:31項目PASS。未認証・未登録・期限切れ・停止・他案件・未承認公開・不正設定・400KB超過・不正回答・受付停止・誤った受信ID・ネットワーク失敗等。
- 分析・暗号化・復元・設定CLI:11項目PASS。誤鍵・改ざん拒否、案件分離、自由入力/備考非表示、重複行拒否、grant/revoke履歴、削除計画の案件・受付完全一致と対象不明時の拒否。
- V1.0既存テスト:15項目PASS。
- 自動受信テストのGoogleは模擬。次の実保存結果と区別する。

## 実ブラウザとGoogle
- 未ログインcurl401。代表のログインで画面を表示。
- 未許可案件パラメータで回答画面を開けず、拒否メッセージを表示。
- 任意保存OFFで会社名入力→再読み込み後に空欄。
- 任意保存ONで会社名入力→再読み込み後に復元。
- 別タブでは会社名が空欄。元タブの回答を取得しない。
- /opsは代表の本人IDでアクセス可能。顧客公開未承認・顧客登録なし・保持期限決裁待ちを表示。
- 全16分野の必須21項目を架空情報で入力。受付停止をfalseへ変更して送信し、503相当の停止エラー・完了非表示・再試行有効・タブ内回答保持を確認。
- 再読み込み後21/149の進捗を復元。受付を復旧して同じ回答を送信。
- UI受付ID:46597c86-4a07-4576-814e-10421463c91e
- 保存照合ID:V11-ca3f3f3ef243feb5911b102b521ee1feb063d977e998b891ac8d1ea04a5e07bb
- Google案件ID:QA-V11-OWNER
- Google受信時刻:20:46:29.504 JST
- Answers611〜759行の149項目が同じ保存照合ID・案件ID。条件分岐で全定義162問から149項目となった。
- 既存GASへ同じ保存照合IDを直接再送してHTTP200・ok:true・duplicate:true。Googleの該当行数149のまま。
- UI成功後は任意保存をOFF・無効化、旧回答の入力DOM/確認一覧/メモリを消去。再読み込み後の会社名空欄を確認。成功IDで画面編集・再送を繰り返させない。
- 実顧客情報は使用していない。

## バックアップ・復旧・整理
- 原本・変更前バックアップ・復旧演習コピーはすべて所有者のみ。
- 変更前バックアップID:1NK5xnEw7GCDVDTIqgrKVF8vDNAv5XXpmBuOYUPMy8o8
- 復旧演習コピーID:1g4xxkfXWjlSskujXVuLKXZK-xfvE3QdDF4xq2jKGUfA
- 原本に当時あった609行＋8列見出しを読み戻し、バックアップ・復旧コピーと全セル一致。
- canonical JSON SHA256:5efdc7ff2b5a8748bcdb9732dc8ec1887debf56169d3ccd97f0fa7065e5d6fe3
- 同じ実スナップショットの暗号化・復号を一時鍵で演習し完全一致。恒久的な別保管用暗号化ファイルは作成していない。恒久バックアップは上記Googleコピー。
- 当時のデータ4受付を案件/受付別に正規化。自由入力・備考は既定で非表示。
- 原本への復旧上書き・削除・保存先ID切替はしていない。

## 表示と未検証
- PC1408px、document scrollWidth1393px。横はみ出しなし。
- Chrome viewport390px、document scrollWidth375px。横はみ出しなし。
- スマホデザイン6見本の各カード148.5px/scrollWidth147px。文字の縦重なりを修正し再検収。
- iPhone Safari・Android Chromeの実機は未検証。
- 実顧客2アカウントの登録/招待・相互拒否・期限到来は未実施。自動テストのみで実顧客確認とは報告しない。
- 保持期限、バックアップ頻度/担当/別保管先/鍵管理、削除窓口は代表決裁待ち。
- 定期自動バックアップ・自動削除は未設定。
