import React,{useCallback,useEffect,useRef,useState} from 'react';
import * as zrender from 'zrender';
import {connect,getCell,type SheetSnapshot,type SheetOp} from './sharedb-client';

const CW=112,RH=29,HW=52,HH=34,ROWS=200,COLS=26;
const label=(i:number)=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const coords=(r:number,c:number,top:number,left:number)=>({x:HW+c*CW-left,y:HH+r*RH-top});

function CanvasSheet({sheet,selected,onSelect,onDoubleClick}:{
 sheet:SheetSnapshot|null;selected:[number,number];onSelect:(v:[number,number])=>void;onDoubleClick:()=>void;
}){
 const host=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null);
 const [scroll,setScroll]=useState({top:0,left:0});
 useEffect(()=>{
   if(!stage.current)return;
   const zr=zrender.init(stage.current,{renderer:'canvas',devicePixelRatio:window.devicePixelRatio||1});
   const draw=()=>{
     if(!stage.current)return;
     const w=stage.current.clientWidth,h=stage.current.clientHeight;
     zr.resize({width:w,height:h});zr.clear();
     const rect=(x:number,y:number,width:number,height:number,fill:string,stroke='#e0e5ed')=>
       zr.add(new zrender.Rect({shape:{x,y,width,height},style:{fill,stroke,lineWidth:1},silent:true}));
     const text=(x:number,y:number,value:string,color='#25304a',align:'left'|'center'='left')=>
       zr.add(new zrender.Text({style:{x,y,text:value,fill:color,font:'13px system-ui',align,verticalAlign:'middle'},silent:true}));
     rect(0,0,w,h,'#fff');
     const rowStart=Math.floor(scroll.top/RH),colStart=Math.floor(scroll.left/CW);
     const rowEnd=Math.min(ROWS,rowStart+Math.ceil((h-HH)/RH)+2);
     const colEnd=Math.min(COLS,colStart+Math.ceil((w-HW)/CW)+2);
     for(let r=rowStart;r<rowEnd;r++)for(let c=colStart;c<colEnd;c++){
       const {x,y}=coords(r,c,scroll.top,scroll.left);
       rect(x,y,CW,RH,'#fff');
       const v=getCell(sheet as SheetSnapshot,r,c)?.value;
       if(v!==undefined&&v!==null)text(x+8,y+RH/2,String(v).slice(0,18));
     }
     rect(0,0,HW,HH,'#f0f3f9');
     for(let c=colStart;c<colEnd;c++){
       const {x}=coords(0,c,0,scroll.left);
       rect(x,0,CW,HH,'#f0f3f9');
       text(x+CW/2,HH/2,label(c),'#697891','center');
     }
     for(let r=rowStart;r<rowEnd;r++){
       const {y}=coords(r,0,scroll.top,0);
       rect(0,y,HW,RH,'#f0f3f9');
       text(HW/2,y+RH/2,String(r+1),'#697891','center');
     }
     const [r,c]=selected;
     const {x,y}=coords(r,c,scroll.top,scroll.left);
     if(x+CW>HW&&y+RH>HH&&x<w&&y<h)
       zr.add(new zrender.Rect({shape:{x:x+1,y:y+1,width:CW-2,height:RH-2},style:{fill:'transparent',stroke:'#3479e6',lineWidth:2},silent:true}));
   };
   const hit=(e:any)=>{
     const x=e.offsetX,y=e.offsetY;
     if(x<HW||y<HH)return;
     const c=Math.floor((x-HW+scroll.left)/CW),r=Math.floor((y-HH+scroll.top)/RH);
     if(r>=0&&r<ROWS&&c>=0&&c<COLS)onSelect([r,c]);
   };
   const resize=new ResizeObserver(draw);
   resize.observe(stage.current);
   draw();
   return()=>{resize.disconnect();zr.dispose();};
 },[sheet,selected,scroll]);
 const hit=(e:React.MouseEvent<HTMLDivElement>)=>{
   const bounds=e.currentTarget.getBoundingClientRect();
   const x=e.clientX-bounds.left,y=e.clientY-bounds.top;
   if(x<HW||y<HH)return;
   const c=Math.floor((x-HW+scroll.left)/CW),r=Math.floor((y-HH+scroll.top)/RH);
   if(r>=0&&r<ROWS&&c>=0&&c<COLS)onSelect([r,c]);
 };
 return <div className="sheet-viewport" ref={host} tabIndex={0} aria-label="表格滚动区域">
   <div className="sheet-scroll" onClick={hit} onDoubleClick={onDoubleClick} onScroll={e=>setScroll({top:e.currentTarget.scrollTop,left:e.currentTarget.scrollLeft})}>
     <div style={{width:HW+COLS*CW,height:HH+ROWS*RH}} />
   </div>
   <div className="sheet-stage" ref={stage}/>
 </div>;
}

export function SheetApp(){
 const [sheet,setSheet]=useState<SheetSnapshot|null>(null);
 const [status,setStatus]=useState('连接中'),[version,setVersion]=useState(0);
 const [selected,setSelected]=useState<[number,number]>([0,0]);
 const [edit,setEdit]=useState(''),[events,setEvents]=useState<string[]>([]);
 const input=useRef<HTMLInputElement>(null);
 const connection=useRef<ReturnType<typeof connect>|null>(null);
 const sheetId=(new URLSearchParams(location.search).get('sheet')||'demo').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'demo';
 useEffect(()=>{
   const c=connect(sheetId,setStatus);
   connection.current=c;
   const update=()=>{setSheet(c.doc.data?structuredClone(c.doc.data):null);setVersion(c.doc.version??0);};
   const onOp=(op:SheetOp[],source:boolean)=>{
     update();setEvents(v=>[(source?'本地 ':'远程 ')+JSON.stringify(op).slice(0,160),...v].slice(0,15));
   };
   c.doc.on('load',update);c.doc.on('op',onOp);
   if(c.doc.data)update();
   return()=>{c.doc.removeListener('load',update);c.doc.removeListener('op',onOp);c.close();connection.current=null;};
 },[sheetId]);
 useEffect(()=>{setEdit(String(getCell(sheet as SheetSnapshot,...selected)?.value??''));},[sheet,selected]);
 const submit=(op:SheetOp)=>{
   const doc=connection.current?.doc;
   if(!doc||!sheet){setStatus('尚未连接');return;}
   doc.submitOp([op],(err:Error|null)=>{if(err)setStatus('OP 提交失败：'+err.message);});
 };
 const save=()=>{
   const [r,c]=selected,oldV=getCell(sheet as SheetSnapshot,r,c);
   if(String(oldV?.value??'')===edit)return;
   submit({type:'update-cell',at:[r,c],oldV,newV:edit===''?null:{value:edit},id:crypto.randomUUID()});
 };
 const insert=(axis:'row'|'col')=>submit({type:axis==='row'?'insert-row':'insert-col',at:selected[axis==='row'?0:1],count:1,id:crypto.randomUUID(),follow:'before'});
 const onSelect=useCallback((v:[number,number])=>setSelected(v),[]);
 const onDoubleClick=useCallback(()=>input.current?.focus(),[]);
 return <div className="app">
   <header><h1>Sheet OT 协同工作台</h1><span className="state">{status}</span><span>Sheet：{sheetId}</span><span>Version：{version}</span></header>
   <section className="toolbar"><strong>{label(selected[1])}{selected[0]+1}</strong>
    <input ref={input} value={edit} onChange={e=>setEdit(e.target.value)}
     onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing)save();}} aria-label="单元格内容"/>
    <button onClick={save}>提交单元格</button><button onClick={()=>insert('row')}>插入行</button>
    <button onClick={()=>insert('col')}>插入列</button><a href={'/?sheet='+sheetId} target="_blank" rel="noreferrer">新窗口协同</a>
   </section>
   <main><CanvasSheet sheet={sheet} selected={selected} onSelect={onSelect} onDoubleClick={onDoubleClick}/>
     <aside><h3>OP 调试面板</h3><p>本地内存协同环境；服务重启会丢失数据。正在显示可视区域。</p>
      {events.map((e,i)=><pre key={i}>{e}</pre>)}</aside></main>
   <footer>React · ZRender · ShareDB · @bzl/sheet-ottype</footer>
 </div>;
}
