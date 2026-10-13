import React,{useEffect,useRef,useState} from 'react';
import * as zrender from 'zrender';
import {connect,getCell,type SheetSnapshot,type SheetOp} from './sharedb-client';
const CW=112,RH=29,HEADER_W=52,HEADER_H=34,ROWS=200,COLS=26;
function label(i:number){let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function gridCell(r:number,c:number){return {x:HEADER_W+c*CW,y:HEADER_H+r*RH};}
function CanvasSheet({sheet,selected,onSelect}:{sheet:SheetSnapshot|null;selected:[number,number];onSelect:(v:[number,number])=>void}){
 const el=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!el.current)return; const zr=zrender.init(el.current,{renderer:'canvas',devicePixelRatio:window.devicePixelRatio||1});
 const draw=()=>{zr.clear();const w=el.current!.clientWidth,h=el.current!.clientHeight;zr.resize({width:w,height:h});
 const rect=(x:number,y:number,width:number,height:number,fill:string,stroke='#e3e7ee')=>zr.add(new zrender.Rect({shape:{x,y,width,height},style:{fill,stroke,lineWidth:1},silent:true}));
 const text=(x:number,y:number,value:string,color='#25304a',align:'left'|'center'='left')=>zr.add(new zrender.Text({style:{x,y,text:value,fill:color,font:'13px system-ui',align,verticalAlign:'middle'},silent:true}));
 rect(0,0,w,h,'#fff');rect(0,0,HEADER_W,HEADER_H,'#f3f5f9');
 const visibleRows=Math.min(ROWS,Math.ceil((h-HEADER_H)/RH)); const visibleCols=Math.min(COLS,Math.ceil((w-HEADER_W)/CW));
 for(let c=0;c<visibleCols;c++){const {x}=gridCell(0,c);rect(x,0,CW,HEADER_H,'#f3f5f9');text(x+CW/2,HEADER_H/2,label(c),'#67738c','center');}
 for(let r=0;r<visibleRows;r++){const {y}=gridCell(r,0);rect(0,y,HEADER_W,RH,'#f3f5f9');text(HEADER_W/2,y+RH/2,String(r+1),'#67738c','center');
 for(let c=0;c<visibleCols;c++){const {x}=gridCell(r,c);rect(x,y,CW,RH,'#fff');const v=getCell(sheet as SheetSnapshot,r,c)?.value;if(v!==undefined&&v!==null)text(x+8,y+RH/2,String(v).slice(0,16));}}
 const [r,c]=selected;const {x,y}=gridCell(r,c);zr.add(new zrender.Rect({shape:{x:x+1,y:y+1,width:CW-2,height:RH-2},style:{fill:'transparent',stroke:'#3578e5',lineWidth:2},silent:true}));};
 const click=(e:any)=>{const c=Math.floor((e.offsetX-HEADER_W)/CW),r=Math.floor((e.offsetY-HEADER_H)/RH);if(r>=0&&r<ROWS&&c>=0&&c<COLS)onSelect([r,c]);};
 zr.on('click',click);const resize=new ResizeObserver(draw);resize.observe(el.current);draw();return()=>{resize.disconnect();zr.off('click',click);zr.dispose();};
 },[sheet,selected,onSelect]);return <div ref={el} className="canvas" aria-label="表格画布"/>;
}
export function SheetApp(){
 const [sheet,setSheet]=useState<SheetSnapshot|null>(null),[status,setStatus]=useState('连接中'),[version,setVersion]=useState(0),[selected,setSelected]=useState<[number,number]>([0,0]),[edit,setEdit]=useState(''),[events,setEvents]=useState<string[]>([]);
 const connection=useRef<ReturnType<typeof connect>|null>(null);
 const sheetId=(new URLSearchParams(location.search).get('sheet')||'demo').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'demo';
 useEffect(()=>{const c=connect(sheetId,setStatus);connection.current=c;const update=()=>{setSheet(c.doc.data?structuredClone(c.doc.data):null);setVersion(c.doc.version??0);};
 const onOp=(op:SheetOp[],source:boolean)=>{update();setEvents(v=>[(source?'本地 ':'远程 ')+JSON.stringify(op).slice(0,150),...v].slice(0,12));};
 c.doc.on('load',update);c.doc.on('op',onOp);if(c.doc.data)update();return()=>{c.doc.removeListener('load',update);c.doc.removeListener('op',onOp);c.close();connection.current=null;};},[sheetId]);
 useEffect(()=>{setEdit(String(getCell(sheet as SheetSnapshot,...selected)?.value??''));},[sheet,selected]);
 const submit=(op:SheetOp)=>{const doc=connection.current?.doc;if(!doc||!sheet){setStatus('尚未连接');return;}doc.submitOp([op],(err:Error|null)=>{if(err)setStatus('OP 提交失败：'+err.message);});};
 const save=()=>{const [r,c]=selected;const oldV=getCell(sheet as SheetSnapshot,r,c);submit({type:'update-cell',at:[r,c],oldV,newV:edit===''?null:{value:edit},id:crypto.randomUUID()});};
 const insert=(direction:'row'|'col')=>submit({type:direction==='row'?'insert-row':'insert-col',at:selected[direction==='row'?0:1],count:1,id:crypto.randomUUID(),follow:'before'});
 return <div className="app"><header><h1>Sheet OT 协同工作台</h1><span className="state">{status}</span><span>Sheet：{sheetId}</span><span>Version：{version}</span></header><section className="toolbar"><strong>{label(selected[1])}{selected[0]+1}</strong><input value={edit} onChange={e=>setEdit(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')save();}} aria-label="单元格内容"/><button onClick={save}>提交单元格</button><button onClick={()=>insert('row')}>插入行</button><button onClick={()=>insert('col')}>插入列</button><a href={'/?sheet='+sheetId} target="_blank" rel="noreferrer">新窗口协同</a></section><main><CanvasSheet sheet={sheet} selected={selected} onSelect={setSelected}/><aside><h3>OP 调试面板</h3><p>后端使用内存 ShareDB，刷新后仍可同步，服务重启后数据清空。</p>{events.map((e,i)=><pre key={i}>{e}</pre>)}</aside></main><footer>React · ZRender · ShareDB · @bzl/sheet-ottype</footer></div>;
}
