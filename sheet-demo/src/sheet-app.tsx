import React,{useEffect,useMemo,useRef,useState} from 'react';
import * as zrender from 'zrender';
import CanvasPainter from 'zrender/lib/canvas/Painter';
// Explicit registration survives production tree shaking.
zrender.registerPainter('canvas',CanvasPainter);
import {connect,getCell,type SheetSnapshot,type SheetOp} from './sharedb-client';

type Point=[number,number];
type Range=[number,number,number,number]; // Sheet ranges use [column,row,column,row].
const CW=112,RH=29,HW=52,HH=34;
const label=(i:number)=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const rangeOf=(a:Point,b:Point):Range=>[Math.min(a[1],b[1]),Math.min(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[0],b[0])];
const contains=(range:Range,r:number,c:number)=>c>=range[0]&&c<=range[2]&&r>=range[1]&&r<=range[3];
const overlaps=(a:Range,b:Range)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];

function CanvasSheet({sheet,selected,anchor,onSelect,onEdit}:{sheet:SheetSnapshot|null;selected:Point;anchor:Point;onSelect:(p:Point,extend:boolean)=>void;onEdit:()=>void}){
 const stage=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),scroller=useRef<HTMLDivElement>(null);
 const zr=useRef<zrender.ZRenderType|null>(null),dragging=useRef(false);
 const [scroll,setScroll]=useState({top:0,left:0}),[size,setSize]=useState({width:0,height:0});
 const rows=sheet?.config.row??200,cols=sheet?.config.column??26;
 useEffect(()=>{
  const el=scroller.current;if(!el)return;
  const top=selected[0]*RH,left=selected[1]*CW,h=el.clientHeight-HH,w=el.clientWidth-HW;
  if(top<el.scrollTop)el.scrollTop=top;else if(top+RH>el.scrollTop+h)el.scrollTop=top+RH-h;
  if(left<el.scrollLeft)el.scrollLeft=left;else if(left+CW>el.scrollLeft+w)el.scrollLeft=left+CW-w;
 },[selected]);
 const cells=useMemo(()=>new Map(sheet?.data.rows.flatMap(row=>(row.children??[]).map(cell=>[`${row.index}:${cell.index}`,cell.meta?.value] as const))),[sheet]);
 useEffect(()=>{
  if(!stage.current)return;
  zr.current=zrender.init(stage.current,{renderer:'canvas'});
  const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
  observer.observe(stage.current);
  return()=>{observer.disconnect();zr.current?.dispose();zr.current=null;};
 },[]);
 useEffect(()=>{
  const canvas=zr.current;if(!canvas)return;
  let frame=requestAnimationFrame(()=>{
   const {width:w,height:h}=size;
   canvas.resize({width:w,height:h});canvas.clear();
   const rect=(group:zrender.Group,x:number,y:number,width:number,height:number,fill:string,stroke='#e0e5ed')=>group.add(new zrender.Rect({shape:{x,y,width,height},style:{fill,stroke,lineWidth:1},silent:true}));
   const text=(group:zrender.Group,x:number,y:number,value:string,align:'left'|'center'='left',width=CW-16)=>group.add(new zrender.Text({style:{x,y,text:value,fill:'#25304a',font:'13px system-ui',align,verticalAlign:'middle',width,overflow:'truncate'},silent:true}));
   const body=new zrender.Group();body.setClipPath(new zrender.Rect({shape:{x:HW,y:HH,width:Math.max(0,w-HW),height:Math.max(0,h-HH)}}));canvas.add(body);
   const rowStart=Math.floor(scroll.top/RH),colStart=Math.floor(scroll.left/CW);
   const rowEnd=Math.min(rows,rowStart+Math.ceil((h-HH)/RH)+2),colEnd=Math.min(cols,colStart+Math.ceil((w-HW)/CW)+2);
   const x=(c:number)=>HW+c*CW-scroll.left,y=(r:number)=>HH+r*RH-scroll.top;
   const merges=Object.values(sheet?.config.merge??{});
   for(let r=rowStart;r<rowEnd;r++)for(let c=colStart;c<colEnd;c++){
    rect(body,x(c),y(r),CW,RH,'#fff');
    if(!merges.some(m=>contains(m,r,c))){const value=cells.get(`${r}:${c}`);if(value!=null)text(body,x(c)+8,y(r)+RH/2,String(value));}
   }
   for(const m of merges){if(!overlaps(m,[colStart,rowStart,colEnd-1,rowEnd-1]))continue;
    const width=(m[2]-m[0]+1)*CW,height=(m[3]-m[1]+1)*RH;
    rect(body,x(m[0]),y(m[1]),width,height,'#fff');
    const value=cells.get(`${m[1]}:${m[0]}`);if(value!=null)text(body,x(m[0])+8,y(m[1])+RH/2,String(value),'left',width-16);
   }
   let range=rangeOf(anchor,selected);
   for(const m of merges)if(overlaps(range,m))range=[Math.min(range[0],m[0]),Math.min(range[1],m[1]),Math.max(range[2],m[2]),Math.max(range[3],m[3])];
   body.add(new zrender.Rect({shape:{x:x(range[0])+1,y:y(range[1])+1,width:(range[2]-range[0]+1)*CW-2,height:(range[3]-range[1]+1)*RH-2},style:{fill:'rgba(52,121,230,.08)',stroke:'#3479e6',lineWidth:2},silent:true}));
   const headers=new zrender.Group();canvas.add(headers);
   rect(headers,0,0,w,HH,'#f0f3f9');rect(headers,0,0,HW,h,'#f0f3f9');
   for(let c=colStart;c<colEnd;c++){rect(headers,x(c),0,CW,HH,'#f0f3f9');text(headers,x(c)+CW/2,HH/2,label(c),'center');}
   for(let r=rowStart;r<rowEnd;r++){rect(headers,0,y(r),HW,RH,'#f0f3f9');text(headers,HW/2,y(r)+RH/2,String(r+1),'center');}
   rect(headers,0,0,HW,HH,'#f0f3f9');
   stage.current?.setAttribute('data-first-row',String(rowStart));
   stage.current?.setAttribute('data-rendered-cells',String(Math.max(0,rowEnd-rowStart)*Math.max(0,colEnd-colStart)));
  });return()=>cancelAnimationFrame(frame);
 },[sheet,cells,selected,anchor,scroll,size,rows,cols]);
 const hit=(e:React.PointerEvent<HTMLDivElement>):Point|null=>{
  const bounds=e.currentTarget.getBoundingClientRect(),x=e.clientX-bounds.left,y=e.clientY-bounds.top;
  if(x<HW||y<HH)return null;
  const c=Math.floor((x-HW+scroll.left)/CW),r=Math.floor((y-HH+scroll.top)/RH);
  if(r<0||r>=rows||c<0||c>=cols)return null;
  const merge=Object.values(sheet?.config.merge??{}).find(m=>contains(m,r,c));
  return merge?[merge[1],merge[0]]:[r,c];
 };
 return <div className="sheet-viewport" ref={viewport} tabIndex={0} aria-label="表格滚动区域" onKeyDown={e=>{
  if(e.key==='Enter'){e.preventDefault();onEdit();return;}
  const delta:Record<string,Point>={ArrowDown:[1,0],ArrowUp:[-1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  const d=delta[e.key];if(d){e.preventDefault();onSelect([Math.max(0,Math.min(rows-1,selected[0]+d[0])),Math.max(0,Math.min(cols-1,selected[1]+d[1]))],e.shiftKey);}
 }}>
  <div className="sheet-scroll" ref={scroller} onPointerDown={e=>{const p=hit(e);if(!p)return;dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);viewport.current?.focus();onSelect(p,e.shiftKey);}}
   onPointerMove={e=>{if(dragging.current){const p=hit(e);if(p)onSelect(p,true);}}}
   onPointerUp={()=>{dragging.current=false;}} onPointerCancel={()=>{dragging.current=false;}} onDoubleClick={onEdit}
   onScroll={e=>setScroll({top:e.currentTarget.scrollTop,left:e.currentTarget.scrollLeft})}>
   <div style={{width:HW+cols*CW,height:HH+rows*RH}}/>
  </div><div className="sheet-stage" ref={stage}/>
 </div>;
}

export function SheetApp(){
 const [sheet,setSheet]=useState<SheetSnapshot|null>(null),[status,setStatus]=useState('连接中'),[version,setVersion]=useState(0);
 const [selected,setSelected]=useState<Point>([0,0]),[anchor,setAnchor]=useState<Point>([0,0]);
 const [edit,setEdit]=useState(''),[events,setEvents]=useState<string[]>([]);
 const input=useRef<HTMLInputElement>(null),dirty=useRef(false),selection=useRef<Point>(selected),anchorRef=useRef<Point>(anchor);
 const connection=useRef<ReturnType<typeof connect>|null>(null);
 const sheetId=(new URLSearchParams(location.search).get('sheet')||'demo').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'demo';
 useEffect(()=>{
  const c=connect(sheetId,setStatus);connection.current=c;
  let frame:number|null=null;
  const update=()=>{if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;setSheet(c.doc.data?structuredClone(c.doc.data):null);setVersion(c.doc.version??0);});};
  const onOp=(op:SheetOp[],source:boolean)=>{
   // Follow logical cells after local or remote structural edits.
   for(const o of op)if(o.type==='insert-row'||o.type==='insert-col'){
    const axis=o.type==='insert-row'?0:1;
    for(const ref of [selection,anchorRef]){const p=[...ref.current] as Point;if(p[axis]>=o.at)p[axis]+=o.count;ref.current=p;}
    setSelected(selection.current);setAnchor(anchorRef.current);
   }
   for(const o of op)if(o.type==='update-merge'&&o.newV){
    const m=o.newV as Range;for(const ref of [selection,anchorRef])if(contains(m,...ref.current))ref.current=[m[1],m[0]];
    setSelected(selection.current);setAnchor(anchorRef.current);
   }
   update();setEvents(v=>[(source?'本地 ':'远程 ')+JSON.stringify(op).slice(0,200),...v].slice(0,15));
  };
  c.doc.on('load',update);c.doc.on('op',onOp);c.doc.on('no write pending',update);
  const error=(err:Error)=>setStatus('协同错误：'+err.message);c.doc.on('error',error);
  if(c.doc.data)update();
  return()=>{if(frame!==null)cancelAnimationFrame(frame);c.doc.removeListener('load',update);c.doc.removeListener('op',onOp);c.doc.removeListener('no write pending',update);c.doc.removeListener('error',error);c.close();connection.current=null;};
 },[sheetId]);
 useEffect(()=>{if(!dirty.current)setEdit(String(getCell(sheet as SheetSnapshot,...selected)?.value??''));},[sheet,selected]);
 const submit=(ops:SheetOp[])=>{
  const doc=connection.current?.doc;if(!doc?.type||!sheet){setStatus('尚未完成同步');return false;}
  try{doc.submitOp(ops,(err:Error|null)=>{if(err)setStatus('OP 提交失败：'+err.message);else setVersion(doc.version??0);});return true;}
  catch(err){setStatus('OP 提交失败：'+(err as Error).message);return false;}
 };
 const save=()=>{
  const [r,c]=selection.current,oldV=getCell(connection.current?.doc.data,r,c);
  if(String(oldV?.value??'')===edit){dirty.current=false;return;}
  if(submit([{type:'update-cell',at:[r,c],oldV,newV:edit===''?null:{...oldV,value:edit},id:crypto.randomUUID()}]))dirty.current=false;
 };
 const onSelect=(p:Point,extend:boolean)=>{if(dirty.current)save();dirty.current=false;selection.current=p;setSelected(p);if(!extend){anchorRef.current=p;setAnchor(p);}setEdit(String(getCell(connection.current?.doc.data,...p)?.value??''));};
 const insert=(axis:'row'|'col')=>{save();submit([{type:axis==='row'?'insert-row':'insert-col',at:selected[axis==='row'?0:1],count:1,id:crypto.randomUUID(),follow:'before'}]);};
 const merge=(split:boolean)=>{
  save();const range=rangeOf(anchor,selected),existing=Object.entries(sheet?.config.merge??{}).filter(([,m])=>overlaps(range,m));
  const ops:SheetOp[]=existing.map(([uuid,oldV])=>({type:'update-merge',uuid,oldV,id:crypto.randomUUID()}));
  if(!split){if(range[0]===range[2]&&range[1]===range[3]){setStatus('请拖动或 Shift 选择多个单元格');return;}ops.push({type:'update-merge',uuid:crypto.randomUUID(),newV:range,id:crypto.randomUUID()});}
  if(ops.length)submit(ops);
 };
 const range=rangeOf(anchor,selected);
 return <div className="app">
  <header><h1>Sheet OT 协同工作台</h1><span className="state">{status}</span><span>Sheet：{sheetId}</span><span data-testid="version">Version：{version}</span></header>
  <section className="toolbar"><strong data-testid="selection">{label(range[0])}{range[1]+1}{range[0]!==range[2]||range[1]!==range[3]?`:${label(range[2])}${range[3]+1}`:''}</strong>
   <input ref={input} value={edit} onChange={e=>{dirty.current=true;setEdit(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing)save();if(e.key==='Escape'){dirty.current=false;setEdit(String(getCell(sheet as SheetSnapshot,...selected)?.value??''));}}} aria-label="单元格内容"/>
   <button onClick={save} disabled={!sheet}>提交单元格</button><button onClick={()=>insert('row')} disabled={!sheet}>插入行</button><button onClick={()=>insert('col')} disabled={!sheet}>插入列</button>
   <button onClick={()=>merge(false)} disabled={!sheet}>合并</button><button onClick={()=>merge(true)} disabled={!sheet}>拆分</button><a href={'/?sheet='+sheetId} target="_blank" rel="noreferrer">新窗口协同</a>
  </section>
  <main><CanvasSheet sheet={sheet} selected={selected} anchor={anchor} onSelect={onSelect} onEdit={()=>input.current?.focus()}/><aside><h3>OP 调试面板</h3><p>内存协同环境，服务重启会丢失数据。拖动 / Shift 选择，方向键移动，Enter 编辑。</p>{events.map((e,i)=><pre key={i}>{e}</pre>)}</aside></main>
  <footer>React · ZRender · ShareDB · @bzl/sheet-ottype</footer>
 </div>;
}
