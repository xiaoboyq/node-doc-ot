'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ShareDB=require('@boss/sharedb');
const {SheetOTType}=require('../ot-type.cjs');
const original=require('@bzl/sheet-ottype').SheetOTType;
ShareDB.types.register(SheetOTType);
const call=fn=>new Promise((resolve,reject)=>fn(err=>err?reject(err):resolve()));
const cell=(r,c,value,id)=>({type:'update-cell',at:[r,c],oldV:null,newV:{value},id});
const insert=(axis,at,count,id)=>({type:`insert-${axis}`,at,count,follow:'before',id});
const initial=()=>({id:'x',name:'Test',data:{rows:[],cols:[]},config:{row:200,column:26}});
const value=(data,r,c)=>data.data.rows.find(row=>row.index===r)?.children.find(col=>col.index===c)?.meta.value;
async function clients(t){
 const backend=require('../backend.cjs').createBackend(),ca=backend.connect(),cb=backend.connect();
 t.after(()=>{ca.close();cb.close();backend.close();});
 const a=ca.get('demo','xls#x'),b=cb.get('demo','xls#x');
 await call(done=>a.create(initial(),SheetOTType.name,done));
 await call(done=>a.subscribe(done)); await call(done=>b.subscribe(done));
 return {a,b};
}
test('adapter retains original apply and transform functions',()=>{
 assert.equal(SheetOTType.apply,original.apply);assert.equal(SheetOTType.transform,original.transform);assert.ok(SheetOTType.uri);
});
for(const axis of ['row','col'])test(`concurrent insert-${axis} and asymmetric cell update converge`,async t=>{
 const {a,b}=await clients(t);
 assert.equal(a.version,b.version);
 await Promise.all([call(done=>a.submitOp([insert(axis,axis==='row'?1:3,2,'insert')],done)),call(done=>b.submitOp([cell(2,4,'pending','edit')],done))]);
 await Promise.all([call(done=>a.fetch(done)),call(done=>b.fetch(done))]);
 assert.deepEqual(a.data,b.data);assert.equal(a.version,b.version);
 assert.equal(value(a.data,axis==='row'?4:2,axis==='col'?6:4),'pending');
});
test('concurrent same-cell edits converge and multiple pending edits survive',async t=>{
 const {a,b}=await clients(t);
 await Promise.all([call(done=>a.submitOp([cell(2,4,'A','a')],done)),call(done=>b.submitOp([cell(2,4,'B','b')],done)),call(done=>b.submitOp([cell(3,7,'second','b2')],done))]);
 await Promise.all([call(done=>a.fetch(done)),call(done=>b.fetch(done))]);
 assert.deepEqual(a.data,b.data);assert.equal(value(a.data,3,7),'second');assert.ok(['A','B'].includes(value(a.data,2,4)));
});
test('merge range uses column,row order; structural insert shifts it and split removes it',async t=>{
 const {a,b}=await clients(t);
 await call(done=>a.submitOp([{type:'update-merge',uuid:'merge',newV:[4,2,6,3],id:'m'}],done));
 await call(done=>b.submitOp([insert('row',1,2,'row')],done));
 await call(done=>a.fetch(done));assert.deepEqual(a.data.config.merge.merge,[4,4,6,5]);
 await call(done=>a.submitOp([{type:'update-merge',uuid:'merge',oldV:[4,4,6,5],id:'split'}],done));
 await call(done=>b.fetch(done));assert.deepEqual(a.data,b.data);assert.equal(b.data.config.merge?.merge,undefined);
});
