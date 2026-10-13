'use strict';
// Standalone memory adapter; original Egg/Dubbo code remains untouched.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {Duplex}=require('node:stream');
const WebSocket=require('ws');
const {SheetOTType}=require('./ot-type.cjs');
const backend=require('./backend.cjs').createBackend();
const dist=path.join(__dirname,'dist');
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,mode:'memory',type:SheetOTType.name}));return;}
 const file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Run npm run build, or use the Vite dev server.');return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 });
});
const wss=new WebSocket.Server({server,maxPayload:1024*1024});
const creating=new Map();
function ensureSheet(id){
 if(creating.has(id))return creating.get(id);
 const conn=backend.connect(),doc=conn.get('demo',id);
 const task=new Promise((resolve,reject)=>doc.fetch(err=>{
  if(err)return reject(err);if(doc.type)return resolve();
  doc.create({id,name:'Sheet 1',data:{rows:[],cols:[]},config:{row:200,column:26}},SheetOTType.name,e=>e?reject(e):resolve());
 }));
 creating.set(id,task);
 task.finally(()=>{creating.delete(id);conn.close();}).catch(()=>{});
 return task;
}
wss.on('connection',async(ws,req)=>{
 // Buffer protocol messages during async document creation, including the handshake.
 const stream=new Duplex({objectMode:true,read(){},write(msg,_enc,done){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg),done);else done(new Error('WebSocket closed'));}});
 ws.on('message',raw=>{try{stream.push(JSON.parse(String(raw)));}catch{ws.close(1003,'Invalid JSON');}});
 ws.on('close',()=>stream.destroy());ws.on('error',()=>stream.destroy());
 stream.on('error',()=>{if(ws.readyState===WebSocket.OPEN)ws.close();});
 stream.on('finish',()=>{if(ws.readyState===WebSocket.OPEN)ws.close();});
 try{
  const raw=new URL(req.url,'http://localhost').searchParams.get('sheet')||'demo';
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(raw))throw Error('Invalid sheet id');
  await ensureSheet('xls#'+raw);
  if(ws.readyState!==WebSocket.OPEN)return;
  backend.listen(stream);
 }catch(error){ws.close(1011,String(error.message).slice(0,100));}
});
const port=Number(process.env.SHEET_DEMO_PORT||8787);
server.listen(port,()=>console.log('Sheet collaboration + built Web: http://localhost:'+port+' (in-memory)'));
function shutdown(){for(const ws of wss.clients)ws.terminate();wss.close();server.close();backend.close();}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
