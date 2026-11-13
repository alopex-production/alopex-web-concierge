"""Normalize Google Answers rows without mixing projects. Default export redacts all free text."""
import json,sys,hashlib,argparse
from pathlib import Path
HEADERS=['submission_id','project_id','question_id','question_label','answer_json','note','received_at','schema_version']
SCHEMA=json.loads((Path(__file__).parents[1]/'dist/schema.json').read_text())
def normalize(values,include_sensitive=False):
    if isinstance(values,dict): values=values.get('values',values.get('data',[]))
    if not values or values[0]!=HEADERS: raise ValueError('Unexpected 8-column Answers schema')
    questions={q['id']:q for q in SCHEMA['questions']};groups={}
    for rownum,row in enumerate(values[1:],2):
        if not any(row):continue
        row=(row+['']*8)[:8];sid,pid,qid,label,encoded,note,received,version=row
        if not sid or not pid or qid not in questions or version!=SCHEMA['version']:raise ValueError(f'Invalid metadata at row {rownum}')
        q=questions[qid]
        if label!=q['label']:raise ValueError(f'Question label mismatch at row {rownum}')
        answer=json.loads(encoded)
        if q['type']=='multi':
            if not isinstance(answer,list) or len(set(answer))!=len(answer) or any(a not in q['options'] for a in answer):raise ValueError('Invalid multi answer')
        elif not isinstance(answer,str):raise ValueError('Invalid scalar answer')
        if q['type'] in ['single','design'] and answer:
            options=q['options'] if q['type']=='single' else ['白基調','ダーク','ナチュラル','高級感','シンプル','ポップ']
            if answer not in options:raise ValueError('Invalid option')
        group=groups.setdefault((pid,sid),{'projectId':pid,'submissionId':sid,'schemaVersion':version,'answers':{},'receivedAt':received})
        if qid in group['answers']:raise ValueError(f'Duplicate question for same project/receipt at row {rownum}')
        group['answers'][qid]={'questionId':qid,'label':label,'answer':answer,'note':note,'section':SCHEMA['sections'][q['section']]}
    result=[]
    for (pid,sid),g in sorted(groups.items()):
        a={k:v['answer'] for k,v in g['answers'].items()}
        checks=[]
        if a.get('S16Q01') and a.get('S16Q01')==a.get('S16Q02'):checks.append({'questionIds':['S16Q01','S16Q02'],'reason':'第一・第二優先が同じ'})
        if a.get('S10Q01')=='映像は不要' and a.get('S06Q10')=='映像中心':checks.append({'questionIds':['S10Q01','S06Q10'],'reason':'映像不要とトップ映像中心の整合を確認'})
        rows=list(g['answers'].values())
        for x in rows:
            q=questions[x['questionId']]
            x['answered']=bool(x['answer'])
            if not include_sensitive:
                x['note']='[備考非表示]' if x['note'] else ''
                if q['type'] not in ['single','multi','design']:x['answer']='[自由入力非表示]' if x['answer'] else ''
        result.append({**g,'answers':rows,'coverage':{'recordedQuestions':len(rows),'answeredQuestions':sum(x['answered'] for x in rows)},'recommendations':{'status':'担当者確認前・事実ではない','checks':checks}})
    return {'format':'alopex-analysis-v1.1','sensitiveIncluded':include_sensitive,'schemaSha256':hashlib.sha256(json.dumps(SCHEMA,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'submissions':result}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('output');p.add_argument('--include-sensitive',action='store_true');args=p.parse_args()
    data=normalize(json.loads(Path(args.input).read_text()),args.include_sensitive)
    with open(args.output,'x',encoding='utf8') as f:json.dump(data,f,ensure_ascii=False,indent=2)
    print(json.dumps({'submissions':len(data['submissions']),'sensitiveIncluded':data['sensitiveIncluded']}))
