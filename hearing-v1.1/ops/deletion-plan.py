"""Produces a bounded deletion review plan, never writes to the live Google Sheet."""
import json,argparse,hashlib
from pathlib import Path
from normalize import HEADERS
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('output');p.add_argument('--project',required=True);p.add_argument('--receipt',required=True);args=p.parse_args()
 rows=json.loads(Path(args.input).read_text());rows=rows.get('values',[]) if isinstance(rows,dict) else rows
 if not rows or rows[0]!=HEADERS:raise SystemExit('Unexpected Answers schema')
 selected=[i for i,r in enumerate(rows[1:],2) if len(r)>1 and r[0]==args.receipt and r[1]==args.project]
 if not selected:raise SystemExit('No exact project + receipt match; no plan created')
 plan={'operation':'deletion_review_only','sourceSha256':hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'projectId':args.project,'submissionId':args.receipt,'sheet':'Answers','rowNumbersDescending':list(reversed(selected)),'rowCount':len(selected),'preconditions':['本人・権限確認','バックアップ作成・復旧確認','最新の受付IDと案件IDを再照合','バックアップ側の削除・保持期限も確認'],'liveGoogleChanged':False}
 with open(args.output,'x',encoding='utf8') as f:json.dump(plan,f,ensure_ascii=False,indent=2)
 print(json.dumps({'matchedRows':len(selected),'liveGoogleChanged':False}))
