import ShareDB from '@boss/sharedb/lib/client';
import { SheetOTType } from '@bzl/sheet-ottype';
// The same OT type is registered on both client and standalone server.
(ShareDB as any).types.register(SheetOTType);
export type Cell = {value: string | number};
export type SheetSnapshot = {id:string; name:string; data:{rows:Array<{index:number;children?:Array<{index:number;meta?:Cell}>}>};config:{row?:number;column?:number}};
export type SheetOp = {type:'update-cell';at:number[];oldV:Cell|null;newV:Cell|null;id:string}|{type:'insert-row'|'insert-col';at:number;count:number;id:string;follow?:'before'|'after'};
export function getCell(sheet:SheetSnapshot,r:number,c:number):Cell|null {
 const row=sheet?.data?.rows?.find(x=>x.index===r);
 return row?.children?.find(x=>x.index===c)?.meta ?? null;
}
export function connect(sheetId:string,onStatus:(s:string)=>void){
 const scheme=location.protocol==='https:'?'wss':'ws';
 const ws = new WebSocket(scheme+'://'+location.hostname+':8787/?sheet='+encodeURIComponent(sheetId));
 const connection=new (ShareDB as any).Connection(ws);
 const doc=connection.get('demo','xls#'+sheetId);
 ws.addEventListener('open',()=>onStatus('已连接'));
 ws.addEventListener('close',()=>onStatus('连接已断开，请刷新后重新同步'));
 ws.addEventListener('error',()=>onStatus('连接出错'));
 doc.subscribe((err:Error|null)=>{if(err) onStatus('订阅失败：'+err.message);else onStatus('协同中');});
 return {doc,ws,connection,close:()=>{doc.unsubscribe(()=>{});ws.close();connection.close();}};
}
