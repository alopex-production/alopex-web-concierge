# ALOPEX WEB CONCIERGE V1.1 運用マニュアル

作成日：2026-11-13。最終決裁：東基済代表。顧客への公開・招待は未承認。

## 1. 環境と保全

- 開発ブランチ：`work/hearing-v1.1-20261113`。V1.1の変更先は `hearing-v1.1/` のみ。
- V1.0の162問とschemaVersion `1.0.0`、既存GAS・保存列を維持。GASコード・デプロイ設定は変更しない。
- V1.0確認サイト：https://alopex-concierge-hearing-v1.smart-drake-4743.chatgpt.site
- V1.1は別の代表限定Sites環境。main・公式サイト・V1.0公開バージョンへの変更は禁止。
- `node package.mjs` はV1.0との質問定義の完全一致を確認してからWorkerを生成する。

## 2. 顧客別アクセスを開ける前

現時点は `DEPLOYMENT_MODE=review`、`CLIENT_RELEASE_APPROVED=false`、Sitesもownerのみ。顧客を招待しない。代表限定の検収用案件 `QA-V11-OWNER` だけが使用できる。

代表承認後に以下を順に実施する。

1. 顧客と担当案件を確認。氏名だけで許可しない。Sitesへの個別閲覧許可を付与する人を代表が決裁する。
2. 顧客はChatGPTで本人ログインする。Sitesが注入する `oai-authenticated-user-id` を `/api/identity` で本人が確認する。メールアドレスだけでIDを推測しない。IDはSiteごとに異なる。
3. 案件IDは個人情報を含まない3〜80文字の英数・ハイフン。V1.0の案件IDを転用せず、案件台帳で一意にする。
4. 以下でアクセス設定案を作る。期限は代表決裁に従い、ISO8601で指定する。

```sh
node ops/access.mjs grant private/access-registry.json USER_ID PROJECT_ID 2027-01-31T14:59:59Z
node ops/access.mjs validate private/access-registry.json
```

5. 設定案の案件・本人・期限・履歴を照合し、runtimeの秘密設定 `ACCESS_REGISTRY` にJSONを登録する。`OPERATOR_IDS` は代表のSite本人IDだけ。秘密値・登録済み本人IDをGitや顧客メールへ貼らない。
6. 決裁後に `DEPLOYMENT_MODE=clients`、`CLIENT_RELEASE_APPROVED=true` へ変更・再デプロイする。review用の `REVIEW_OWNER_ONLY_CONFIRMED` はfalseにする。Sitesの外部閲覧許可も指定顧客だけにする。一般公開にはしない。
7. 顧客AがAだけに回答でき、Bの案件IDへの送信が403になることを実アカウントで確認する。自動テストだけを実顧客検収と呼ばない。

管理画面 `/ops` は代表向け照会画面。アクセス登録・停止の変更は上記CLIで設定案を作り、実行環境へ反映する運用。ブラウザからの自己登録・権限拡大機能は設けていない。

## 3. 期限・停止・案件切替

- 期限切れ・停止・未登録の組合せはサーバーが毎回拒否する。ブラウザに案件IDを書き換えても他案件へ保存できない。
- 同じ人に複数案件がある場合、`/?projectId=PROJECT_ID` で許可された案件を選ぶ。URLに氏名・メール・回答は含めない。
- 停止：`node ops/access.mjs revoke private/access-registry.json USER_ID PROJECT_ID`。更新したACCESS_REGISTRYを反映・再デプロイし、対象者の送信403を確認する。
- 受付全停止：`ACCEPT_SUBMISSIONS=false` を設定して再デプロイ。実画面とAPIの503を確認し、その後の保存行数が増えないことを照合する。
- 環境変数の削除だけで停止しない。V1.0検収で削除が既存バインディングへ反映されなかった事例がある。
- 不測の事態はGASのデプロイをアーカイブするとV1.0も停止するため、代表判断と影響確認が必要。

## 4. 回答受付・保存の照合

- 元のGoogle受信処理をそのまま利用。列は submission_id / project_id / question_id / question_label / answer_json / note / received_at / schema_version。
- UI受付IDと、Google保存照合IDを完了画面で提示する。Google側は `V11-`＋案件ID・UI受付IDから計算するSHA256。別案件で同じUI受付IDを使っても照合IDは異なる。
- 原本の受付ID重複防止を継続利用し、同じ案件・同じ受付IDの再送では行を増やさない。成功した受付IDで回答を訂正しない。訂正は担当者が別受付として記録する。
- 成功にはGoogleのokと保存照合IDの一致が必要。HTTP200だけで成功としない。
- 400：回答形式を確認。401/403：アクセス権確認、一時保存を削除。429：60秒後に同じIDで再試行。502/503：画面を閉じず復旧を待ち、同じIDで再送する。
- 任意の一時保存をONにしていない場合、画面を閉じると回答が失われる。表示の指示を守る。

## 5. 分析用整理

GoogleのAnswersを8列のJSON配列として権限のある担当者だけが取得する。原データはprivate領域に保存しGitへ入れない。

```sh
python3 ops/normalize.py private/answers.json private/analysis-redacted.json
```

- 案件ID＋保存照合IDで分離し、質問IDでラベル・分野を付ける。別案件を混在させない。
- 同じ案件・受付に同じ質問が複数あればエラー。ラベル変更・schema不一致も停止する。
- 既定で自由入力・備考を非表示にする。個人情報が自由入力へ含まれる可能性があるため、名前・メール欄だけの削除に依存しない。
- `--include-sensitive` は権限ある担当者がローカルで原回答を整理するときだけ使用。外部AIへ自動送信しない。
- 回答事実と、優先事項重複・映像方針の不整合候補などの担当者確認事項を別フィールドにする。自動で制作方針を確定しない。

## 6. バックアップ・復旧

### 実施済みの保全と演習

- 変更前バックアップ：https://docs.google.com/spreadsheets/d/1NK5xnEw7GCDVDTIqgrKVF8vDNAv5XXpmBuOYUPMy8o8/edit
- 復旧演習用コピー：https://docs.google.com/spreadsheets/d/1g4xxkfXWjlSskujXVuLKXZK-xfvE3QdDF4xq2jKGUfA/edit
- 両方とも所有者のみ。元・バックアップ・復旧コピーのAnswers609行＋見出しを読み戻し、全セル一致。元シートへの上書き・削除はしていない。

### 通常運用

1. 受付設定変更・回答削除・復旧・GAS変更の前にGoogleシートを日付付きコピーする。原本・バックアップとも公開リンクを作らない。
2. 定期バックアップの担当・頻度は代表決裁後に台帳へ記入。自動定期処理は未設定。
3. コピー元とコピー先の範囲・行数・受付IDを照合する。別保管が必要ならJSONを暗号化する。

```sh
python3 ops/backup.py create private/answers.json private/answers.enc
python3 ops/backup.py restore private/answers.enc private/restore-staging.json
```

パスフレーズは20文字以上の独立したものを非表示入力し、承認されたパスワード管理手段へ別保管。回答ファイル・Git・チャットには記載しない。AES-256-GCM＋scryptを使用し、誤鍵・改ざん時は復元を拒否する。復元先ファイルは新規作成のみで上書きしない。

4. 復旧はコピー・ステージング上で照合してから代表承認を得る。SPREADSHEET_IDの切替はV1.0も影響するため、通常のV1.1ソース復旧と混同しない。
5. ソース復旧はV1.1 Sitesの検証済み保存バージョンへ戻す。アクセス設定・受付停止設定も別途照合する。V1.0のSiteにはデプロイしない。
6. 復旧後、合成テストを1件保存・同じIDで再送し、増加0行を確認。原シートへ復旧データを重ねて追記しない。

## 7. 個人情報・保持・削除

- Google原本・バックアップは所有者のみ。必要な担当者を追加する場合は代表決裁。回答APIには閲覧・一覧取得機能がない。
- パスワード・API秘密値・決済情報・本人確認書類は回答へ入力させない。補足欄にも不要な機微情報を入れないよう案内する。
- V1.1一時保存は既定OFF。ONのときのみタブ別sessionStorageへ保存し、最終操作から24時間の上限で失効。送信成功・アクセス拒否・ユーザー削除で消去する。ブラウザのタブ復元の挙動に注意し、共有端末では使わない。
- 保持期限は未確定。候補として「制作完了後180日、バックアップ30日」を代表へ提示するが、決裁前には自動削除を開始しない。`RETENTION_POLICY=AWAITING_OWNER_APPROVAL` として表示する。
- 削除要求では本人・案件・受付を確認し、バックアップ後に削除計画を作る。

```sh
python3 ops/deletion-plan.py private/answers.json private/deletion-plan.json --project PROJECT_ID --receipt STORAGE_RECEIPT
```

このコマンドは計画のみで本番を削除しない。最新シートと受付IDを再照合し、承認された対象行を下から削除する。バックアップ・復旧コピー・端末内エクスポートも対象へ含め、削除日と担当を記録する。法的な保存義務の判断はこのツールでは行わない。

## 8. 正式運用開始の承認条件

顧客ID・案件・期限、Google担当者権限、保持期限、削除窓口、バックアップ担当・頻度・保管先、実顧客アカウントの相互アクセス拒否検査を確定する。iPhone Safari・Android Chromeの実機検査は未検証。画面幅変更を実機確認と報告しない。

顧客向け公開・招待・一般公開は代表の最終承認後のみ。
