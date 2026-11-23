const HEADERS = ['案件ID','会社名','担当者名','メール','確定日時','通知状態','通知更新日時'];
function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function authorized_(input,secret) {
  if (typeof input!=='string' || !secret || input.length!==secret.length) return false;
  let difference=0;
  for (let i=0;i<secret.length;i++) difference |= input.charCodeAt(i)^secret.charCodeAt(i);
  return difference===0;
}
function doPost(event) {
  const props=PropertiesService.getScriptProperties();
  const request=JSON.parse(event.postData.contents);
  if (!authorized_(request.secret,props.getProperty('V2_GAS_SECRET'))) return reply_({ok:false});
  const item=request.payload;
  if (!item || !/^[a-f0-9-]{36}$/.test(item.submissionId) || !Array.isArray(item.answers)) return reply_({ok:false});
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const book=SpreadsheetApp.openById(props.getProperty('V2_SHEET_ID'));
    const sheet=book.getSheetByName('V2案件') || book.insertSheet('V2案件');
    const existing=sheet.getLastRow()>1 && sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(item.submissionId).matchEntireCell(true).findNext();
    if (!existing) {
      const lastColumn=sheet.getLastColumn();
      const existingLabels=lastColumn>HEADERS.length
        ? sheet.getRange(1,HEADERS.length+1,1,lastColumn-HEADERS.length).getValues()[0] : [];
      const labels=new Set(existingLabels);
      for (const [id,label] of item.answers) labels.add(id+' '+label);
      const columns=[...HEADERS,...labels];
      if (columns.length>sheet.getMaxColumns()) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(),columns.length-sheet.getMaxColumns());
      }
      sheet.getRange(1,1,1,columns.length).setValues([columns]);
      SpreadsheetApp.flush();
      const answers=new Map(item.answers.map(([id,label,value])=>[id+' '+label,Array.isArray(value)?value.join('\n'):value]));
      const row=[item.submissionId,item.company,item.contact,item.email,new Date(item.submittedAt).toISOString(),'PENDING','',
        ...columns.slice(HEADERS.length).map(label=>answers.get(label) || '')];
      // RAW prevents formula evaluation for client-provided text.
      if (sheet.getLastRow()===sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),100);
      SpreadsheetApp.flush();
      Sheets.Spreadsheets.Values.update({values:[row]},book.getId(),"'V2案件'!A"+(sheet.getLastRow()+1),{valueInputOption:'RAW'});
    }
    return reply_({ok:true,submissionId:item.submissionId});
  } finally {
    lock.releaseLock();
  }
}
function notifyPending() {
  const props=PropertiesService.getScriptProperties();
  const sheet=SpreadsheetApp.openById(props.getProperty('V2_SHEET_ID')).getSheetByName('V2案件');
  if (!sheet || sheet.getLastRow()<2) return;
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const rows=sheet.getRange(2,1,sheet.getLastRow()-1,HEADERS.length).getValues();
    let sent=0;
    for (const [index,row] of rows.entries()) {
      if (row[5]!=='PENDING' || sent>=20) continue;
      const recipient=props.getProperty('V2_NOTIFY_TO');
      if (!recipient) throw Error('V2_NOTIFY_TO missing');
      const cell=sheet.getRange(index+2,6,1,2);
      cell.setValues([['SENDING',new Date().toISOString()]]);
      SpreadsheetApp.flush();
      GmailApp.sendEmail(recipient,'ALOPEX WEB制作ヒアリング回答完了 '+row[0],
        'ヒアリング回答が確定しました。\n案件ID '+row[0]+'\nV2専用スプレッドシートで確認してください。');
      cell.setValues([['SENT',new Date().toISOString()]]);
      SpreadsheetApp.flush();
      sent++;
    }
  } finally {
    lock.releaseLock();
  }
}
