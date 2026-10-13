'use strict';
// Standalone in-memory development adapter. Production Egg/Dubbo code is untouched.
const http = require('node:http');
const { Duplex } = require('node:stream');
const WebSocket = require('ws');
const ShareDB = require('@boss/sharedb');
const { SheetOTType } = require('@bzl/sheet-ottype');
ShareDB.types.register(SheetOTType);
const backend = new ShareDB({ presence: true });
const server = http.createServer((_req, res) => { res.writeHead(200, {'content-type':'application/json','access-control-allow-origin':'*'}); res.end(JSON.stringify({ok:true, mode:'memory', type:SheetOTType.name})); });
const wss = new WebSocket.Server({ server });
function initialSheet(id) { return { id, name:'Sheet 1', data:{ rows:[], cols:[] }, config:{ row:200, column:26 } }; }
function ensureSheet(id) { return new Promise((resolve,reject) => {
  const conn = backend.connect(); const doc = conn.get('demo', id);
  doc.fetch(err => { if(err) return reject(err); if(doc.type) return resolve();
    doc.create(initialSheet(id), SheetOTType.name, e => e ? reject(e) : resolve());
  });
}); }
// WebSocket messages carry original ShareDB JSON protocol; do not reimplement OT/ACK.
wss.on('connection', async (ws, req) => {
  let sheetId = 'xls#demo';
  try { const url = new URL(req.url, 'http://localhost'); const raw=url.searchParams.get('sheet')||'demo'; if(!/^[a-zA-Z0-9_-]{1,64}$/.test(raw)) throw Error('Invalid sheet id'); sheetId='xls#'+raw; await ensureSheet(sheetId); }
  catch(error) { ws.close(1011, String(error.message).slice(0,100)); return; }
  const stream = new Duplex({objectMode:true,read(){},write(msg,_enc,done){ if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg),done); else done(new Error('WebSocket closed')); }});
  ws.on('message', raw => { try {stream.push(JSON.parse(String(raw)));} catch {ws.close(1003,'Invalid JSON');} });
  ws.on('close',()=>stream.push(null)); ws.on('error',()=>stream.destroy());
  stream.on('error',()=>{if(ws.readyState===WebSocket.OPEN)ws.close();});
  stream.on('finish',()=>{if(ws.readyState===WebSocket.OPEN)ws.close();});
  backend.listen(stream);
});
const port = Number(process.env.SHEET_DEMO_PORT || 8787);
server.listen(port,()=>console.log('Sheet demo collaboration: ws://localhost:'+port+' (in-memory)'));
