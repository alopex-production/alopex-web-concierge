/** V1.1-only receiver wrapper. The V1.0 deployed project is not edited. */
var NOTIFY_TO='azumamotozumi0303@gmail.com';
function setupNotifications(){
 var p=PropertiesService.getScriptProperties();p.setProperty('SPREADSHEET_ID','1ucbsnjMO35HYutSZRWQburxmv6odynOIu6PvbqKHaak');
 if(!p.getProperty('RECEIVER_SECRET'))p.setProperty('RECEIVER_SECRET',Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''));
 var book=SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID')),s=book.getSheetByName('Notifications');
 if(!s){s=book.insertSheet('Notifications');s.appendRow(['submission_id','project_id','status','attempted_at','completed_at','error']);s.setFrozenRows(1)}
 console.log('Notification setup ready; recipient '+NOTIFY_TO+'; mail quota '+MailApp.getRemainingDailyQuota());
}
function notifySaved_(d){
 var lock=LockService.getScriptLock();if(!lock.tryLock(20000))return 'pending';
 try{
  var p=PropertiesService.getScriptProperties(),book=SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID')),s=book.getSheetByName('Notifications');
  if(!s)throw Error('notification_log_missing');
  var found=s.getRange('A:A').createTextFinder(d.submissionId).matchEntireCell(true).findAll();
  if(found.length)return String(s.getRange(found[0].getRow(),3).getValue()).toLowerCase();
  var row=s.getLastRow()+1,now=new Date().toISOString();s.getRange(row,1,1,6).setValues([[d.submissionId,d.projectId,'SENDING',now,'','']]);SpreadsheetApp.flush();
  try{
   if(MailApp.getRemainingDailyQuota()<1)throw Error('mail_quota_exhausted');
   MailApp.sendEmail({to:NOTIFY_TO,subject:'【ALOPEX WEB CONCIERGE】回答完了｜'+d.projectId,body:'ヒアリング回答をGoogleスプレッドシートに保存しました。\n\n案件ID：'+d.projectId+'\n保存照合ID：'+d.submissionId+'\n保存項目数：'+d.answers.length+'\n\n確認先：https://docs.google.com/spreadsheets/d/'+p.getProperty('SPREADSHEET_ID')+'/edit\n\n回答本文・顧客の個人情報はメールに含めていません。'});
   s.getRange(row,3,1,4).setValues([['SENT',now,new Date().toISOString(),'']]);SpreadsheetApp.flush();return 'sent';
  }catch(err){
   s.getRange(row,3,1,4).setValues([['FAILED',now,new Date().toISOString(),String(err.message).slice(0,300)]]);SpreadsheetApp.flush();return 'failed';
  }
 }finally{if(lock.hasLock())lock.releaseLock()}
}
function doPost(e){
 var result=persistSubmission_(e),r=JSON.parse(result.getContent());
 if(r.ok!==true)return result;
 var d=JSON.parse(e.postData.contents),status;
 try{status=notifySaved_(d)}catch(err){console.error('Notification ledger error for '+r.submissionId+': '+String(err.message).slice(0,200));status='unrecorded_error'}
 return output_({ok:true,submissionId:r.submissionId,duplicate:r.duplicate===true,notificationStatus:status});
}
