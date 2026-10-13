'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ShareDB = require('@boss/sharedb');
const { SheetOTType } = require('@bzl/sheet-ottype');
ShareDB.types.register(SheetOTType);
function asPromise(run) { return new Promise((resolve,reject)=>run(err=>err?reject(err):resolve())); }
test('SheetOTType applies update-cell and transforms insert-row', async () => {
  const backend = new ShareDB();
  const a=backend.connect().get('demo','xls#smoke');
  const b=backend.connect().get('demo','xls#smoke');
  const initial={id:'xls#smoke',name:'Smoke',data:{rows:[],cols:[]},config:{row:20,column:10}};
  await asPromise(cb=>a.create(initial,SheetOTType.name,cb));
  await asPromise(cb=>b.subscribe(cb));
  const cell={type:'update-cell',at:[1,1],oldV:null,newV:{value:'Hello'},id:'smoke-cell'};
  await asPromise(cb=>a.submitOp([cell],cb));
  await asPromise(cb=>b.fetch(cb));
  assert.equal(b.data.data.rows.find(r=>r.index===1).children.find(c=>c.index===1).meta.value,'Hello');
  const row={type:'insert-row',at:0,count:1,follow:'before',id:'smoke-row'};
  await asPromise(cb=>b.submitOp([row],cb));
  await asPromise(cb=>a.fetch(cb));
  assert.equal(a.data.data.rows.find(r=>r.index===2).children.find(c=>c.index===1).meta.value,'Hello');
});
