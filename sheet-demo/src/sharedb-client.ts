import ShareDB from '@boss/sharedb/lib/client';
import { SheetOTType } from 'sheet-demo-ot';

(ShareDB as any).types.register(SheetOTType);
export type Cell = {value: string | number};
export type SheetSnapshot = {
 id:string; name:string;
 data:{rows:Array<{index:number;children?:Array<{index:number;meta?:Cell}>}>};
 config:{row?:number;column?:number;merge?:Record<string,[number,number,number,number]>};
};
export type SheetOp =
 |{type:'update-cell';at:number[];oldV:Cell|null;newV:Cell|null;id:string}
 |{type:'insert-row'|'insert-col';at:number;count:number;id:string;follow?:'before'|'after'}
 |{type:'update-merge';uuid:string;oldV?:number[];newV?:number[];id:string};
export function getCell(sheet:SheetSnapshot,r:number,c:number):Cell|null {
 return sheet?.data?.rows?.find(x=>x.index===r)?.children?.find(x=>x.index===c)?.meta ?? null;
}
export function connect(sheetId:string,onStatus:(s:string)=>void){
 const scheme=location.protocol==='https:'?'wss':'ws';
 const url=scheme+'://'+location.host+'/collaboration?sheet='+encodeURIComponent(sheetId);
 let stopped=false,attempt=0,reconnectTimer:ReturnType<typeof setTimeout>|null=null;
 let socket=new WebSocket(url);
 const connection=new (ShareDB as any).Connection(socket);
 const doc=connection.get('demo','xls#'+sheetId);
 const reconnect=()=>{
   if(stopped||!navigator.onLine)return;
   socket=new WebSocket(url);connection.bindToSocket(socket);attach(socket);
 };
 const offline=()=>{socket.close();onStatus('网络已断开，等待恢复');};
 const online=()=>{if(reconnectTimer)clearTimeout(reconnectTimer);if(socket.readyState===WebSocket.CLOSED)reconnect();};
 window.addEventListener('offline',offline);window.addEventListener('online',online);
 const attach=(ws:WebSocket)=>{
   ws.addEventListener('open',()=>{
     attempt=0;onStatus('WebSocket 已连接，正在同步...');
   });
   ws.addEventListener('close',()=>{
     if(stopped)return;
     attempt++;
     const delay=Math.min(15000,Math.round(500*Math.pow(2,Math.min(attempt,5))));
     onStatus('网络已断开，'+delay+'ms 后重连');
     reconnectTimer=setTimeout(reconnect,delay);
   });
   ws.addEventListener('error',()=>{if(!stopped)onStatus('连接错误，等待自动重连');});
 };
 attach(socket);
 doc.on('subscribed',()=>{if(stopped)return;onStatus('协同中');});
 connection.on('error',(err:Error)=>{if(!stopped)onStatus('协同错误：'+err.message);});
 doc.subscribe((err:Error|null)=>{
   if(stopped)return;
   if(err)onStatus('订阅失败：'+err.message);
   else onStatus('协同中');
 });
 return {doc,connection,close:()=>{
   stopped=true;
   window.removeEventListener('offline',offline);window.removeEventListener('online',online);
   if(reconnectTimer)clearTimeout(reconnectTimer);
   try{doc.unsubscribe(()=>{});}catch{}
   socket.close();
   connection.close();
 }};
}
