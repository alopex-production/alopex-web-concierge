# ALOPEX WEB CONCIERGE 詳細ヒアリング V1.0

状態：実装済み・単体検証済み／非公開公開・実Google保存は未完了。本番利用不可。

## 構成
162問・16分野。各項目の任意備考、複数回答、写真・動画・参考サイト分岐、進捗、30日期限の端末保存、再開、必須検証、送信前確認、受付IDによる再送、完了画面を実装。独自CSSのデザイン見本6種。

フロント：dist/ のHTML/CSS/JS。受信プロキシ：dist/server/index.js（Cloudflare Worker）。保存先：gas/Code.gs + Schema.gs。パスワードやAPI秘密情報はフロントへ置かない。

## 検証方法
node build.py ではなく python3 build.py → node package.mjs → node tests/system.mjs

15項目のNodeテストを通過。Googleサービスは模擬実行であり、実スプレッドシート保存・ブラウザの画面操作を検証したものではない。

## Google連携（アカウントの承認が必要）
1. script.google.com で独立したApps Scriptプロジェクトを作成する。
2. gas/Code.gs と gas/Schema.gs を配置する。
3. setup() を実行し、Googleの権限を承認する。専用スプレッドシートが作成され、スクリプトプロパティにSPREADSHEET_IDが入る。
4. プロジェクト設定のスクリプトプロパティに RECEIVER_SECRET（32バイト以上のランダム値）を登録する。チャットやリポジトリへ秘密値を書かない。
5. デプロイ→新しいデプロイ→ウェブアプリ。「実行ユーザー：自分」。受信サーバーからの接続が可能なアクセス範囲を設定する。組織のポリシーが一般アクセスを禁止する場合はここで停止し、認証方式を再設計する。
6. 公開先Workerの暗号化設定に GAS_URL（/exec URL）と GAS_SECRET（同じ秘密値）を設定する。
7. 全必須回答をテスト入力し、送信、Answersの行数、受付ID、再送時に行が増えないこと、失敗後の再試行を実測する。未接続時はHTTP 503で停止し成功表示しない。

## 管理・分析
Answersは1回答項目1行。列は submission_id / project_id / question_id / question_label / answer_json / note / received_at / schema_version。受信日時はサーバー時刻。配列はJSONで保存。案件IDは現在ブラウザが生成する仮ID。実運用では案件招待と照合する必要がある。

回答を案件・受付IDで抽出してJSON payload形式に戻し、node analyze.mjs answers.json で事実と推奨を分けた整理案を出力できる。AIによる自動提案・Google Sheetの自動読取機能は未実装。担当者または接続済みのAIが権限のあるシートを読み取り、question_idとschema.jsonを使って分析する。推奨案は代表確認後に制作企画へ反映する。

シートのリンク共有を無効にし、担当者へ必要最小限のアクセスを付与する。作成スプレッドシートは初期状態の共有設定を実アカウントで必ず検証する。回答URLに個人情報を含めない。回答の保持期限と削除手順を本番開始前に代表が確定する。端末保存は暗号化しないため共用端末では回答後に削除する。

## セキュリティ・制限
受信秘密値・同一Origin制限・サーバー側の質問/必須/型/選択肢検証、400KB制限、メール単位60秒制限、LockService排他、同一受付IDの既存確認、式注入抑止を実装。一般公開時には別途Cloudflare Accessや有効期限付き案件招待・Turnstile等を導入する必要がある。現在の非公開Sites環境は代表専用の検収用途。クライアント公開の認証を検証するまで実データ受付を開始しない。

受付ID重複判定は同一IDの内容変更を受け付けない。訂正は担当者へ連絡し別の受付として管理する。Googleの書込障害・タイムアウトは再送で既存ID照合するが、Google障害時の完全なトランザクション保証はない。大規模運用はD1等の受付台帳導入を検討する。

## 公開・停止・復旧
既存の公式サイト、mainブランチ、既存Cloudflare Pages設定は変更しない。
独立検収サイトIDは .openai/hosting.json。Sitesのowner-private公開を利用する設計。公開自体はGitサーバーDNSエラーで未完了。
Cloudflare Pages採用の場合は独立プロジェクトを作り、Worker相当のプロキシをPages Functions等に移す。distを単純な静的Pagesとして公開すると送信APIが存在しないため不可。
緊急停止：GASウェブアプリのデプロイをアーカイブ、Worker側GAS_SECRETを削除すれば回答受付が停止（503）。表示も止める場合はホスト側で停止用バージョンを公開／アクセス許可を解除する。復旧：検証済みバージョンへ戻し、秘密値を再設定してテスト受付を確認。停止・復旧の実運用検証は未実施。

## 実装時の結果
- GitHubの既存リポジトリ3件を連携で確認。alopex-web-conciergeのmainは既存営業LP。
- 通常git cloneはgithub.comのDNS解決失敗。
- Sitesは独立したprivateプロジェクト作成済み。source同期はgit.chatgpt-team.siteのDNS解決失敗。デプロイ成功・閲覧URL発行とは扱わない。
- ローカルHTTPサーバーはsocket bindでOperation not permitted。PC/スマホの視覚QA・キーボード操作・端末保存/再開・実送信は未実測。
- Google Apps Scriptのデプロイ操作ツールは現在利用できない。Google承認・連携設定と実保存確認は残作業。
