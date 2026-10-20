'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSheet, iterateRecords } = require('../../lib/sheet-analysis');
const first = (data, options) => analyzeSheet(data, options).tables[0];

test('single header, numeric types and record coordinates', () => {
  const data = [['姓名', '金额'], ['张三', 10], ['李四', 20]];
  const table = first(data);
  assert.deepEqual(table.headerRows, [0]);
  assert.equal(table.needsReview, false);
  assert.equal(table.columns[1].type, 'number');
  assert.equal([...iterateRecords(data, table)].reduce((sum, row) => sum + row.values.c1, 0), 30);
});
test('empty sheet and whitespace', () => {
  assert.deepEqual(analyzeSheet([[], [null, '  ']]).tables, []);
  assert.deepEqual(analyzeSheet([]).tables, []);
});
test('zero and false retained, no numeric header guessed', () => {
  const data = [[0, false], [1, true]];
  const table = first(data);
  assert.deepEqual(table.headerRows, []);
  assert.equal(table.rowCount, 2);
  assert.throws(() => [...iterateRecords(data, table)], /Review/);
  assert.deepEqual([...iterateRecords(data, table, {allowUncertain: true})][0].values, {c0: 0, c1: false});
});
test('ambiguous text rows are preserved', () => {
  const table = first([['张三', '杭州'], ['李四', '上海']]);
  assert.deepEqual(table.headerRows, []);
  assert.equal(table.rowCount, 2);
  assert.ok(table.needsReview);
});
test('explicit no-header override', () => {
  const table = first([['姓名', '金额'], ['李四', 2]], {regions: [{range: [0,0,1,1], headerRows: []}]});
  assert.equal(table.rowCount, 2);
  assert.equal(table.needsReview, false);
});
test('multirow merged header, horizontal and vertical spans', () => {
  const table = first([['地区','销售',null], [null,'数量','金额'], ['杭州',2,10]],
    {merges: [[0,0,0,1], [1,0,2,0]]});
  assert.deepEqual(table.headerRows, [0,1]);
  assert.deepEqual(table.columns.map(c => c.name), ['地区','销售 / 数量','销售 / 金额']);
  assert.deepEqual(table.dataRows, [2]);
});
test('full width merged title preceding header', () => {
  const table = first([['月度报表',null], ['姓名','金额'], ['张三',10]], {merges: [[0,0,1,0]]});
  assert.deepEqual(table.titleRows, [0]);
  assert.deepEqual(table.headerRows, [1]);
});
test('vertically separated tables', () => {
  const result = analyzeSheet([['姓名','金额'],['张三',2],[],['产品','数量'],['笔',3]]);
  assert.equal(result.tables.length, 2);
  assert.deepEqual(result.tables[1].range, [0,3,1,4]);
});
test('side-by-side tables and absolute column coordinates', () => {
  const result = analyzeSheet([['姓名','金额',null,'产品','数量'],['张三',2,null,'笔',3]]);
  assert.equal(result.tables.length, 2);
  assert.deepEqual(result.tables[1].columns.map(c => c.key), ['c3','c4']);
});
test('blank row tolerance preserves one table', () => {
  const table = first([['姓名','金额'], ['张三',1], [], ['李四',2]], {blankRowTolerance: 1});
  assert.deepEqual(table.dataRows, [1,3]);
});
test('repeated header and summary excluded, review required for summary', () => {
  const table = first([['姓名','金额'],['张三',10],['姓名','金额'],['李四',20],['合计',30]]);
  assert.deepEqual(table.dataRows, [1,3]);
  assert.deepEqual(table.repeatedHeaderRows, [2]);
  assert.deepEqual(table.summaryRows, [4]);
  assert.ok(table.needsReview);
});
test('duplicate labels use unique coordinate keys', () => {
  const data = [['金额','金额'], [1,2]];
  assert.deepEqual([...iterateRecords(data, first(data))][0].values, {c0:1,c1:2});
});
test('sparse project snapshot, rich text, merge metadata', () => {
  const rich = text => ({type:'richtext',value:[{children:[{text}]}]});
  const snapshot = {data:{rows:[
    {index:100,children:[{index:4,meta:rich('姓名')},{index:5,meta:rich('金额')}]},
    {index:101,children:[{index:4,meta:rich('张三')},{index:5,meta:{value:10}}]}
  ],cols:[]},config:{}};
  const table = first(snapshot);
  assert.deepEqual(table.range,[4,100,5,101]);
  assert.equal(table.columns[0].name,'姓名');
  assert.equal([...iterateRecords(snapshot,table)][0].values.c5,10);
});
test('style transition helps custom text headers', () => {
  const data = [[{value:'甲类',style:{bold:true}}, {value:'乙类',style:{bold:true}}],['a','b']];
  const table = first(data);
  assert.ok(table.needsReview); // style alone is insufficient
  assert.deepEqual(table.headerRows, []);
});
test('formula cached values are used without eval', () => {
  const data = [['姓名','金额'],['张三',{formula:true,value:'=1+2',result:3}]];
  assert.equal([...iterateRecords(data,first(data))][0].values.c1,3);
});
test('missing formula results produce review warning', () => {
  const result = analyzeSheet([['姓名','金额'],['张三',{formula:true,value:'=1+2'}]]);
  assert.ok(result.warnings.includes('FORMULA_RESULT_MISSING'));
  assert.ok(result.needsReview);
});
test('leading zero codes and formatted numbers remain text', () => {
  const table = first([['编号','金额'],['0012','¥1,200']]);
  assert.equal(table.columns[0].type,'text');
  assert.equal(table.columns[1].type,'text');
});
test('ragged rows, nulls and mixed type counts', () => {
  const table = first([['姓名','金额'],['张三',10],['李四'],['王五','待定']]);
  assert.equal(table.columns[1].type,'mixed');
  assert.deepEqual(table.columns[1].typeCounts,{number:1,empty:1,text:1});
});
test('merged body flags ambiguity without filling down', () => {
  const data = [['地区','金额'],['杭州',10],[null,20]];
  const table = first(data,{merges:[[0,1,0,2]]});
  assert.ok(table.warnings.includes('MERGED_BODY_REQUIRES_REVIEW'));
  assert.equal([...iterateRecords(data,table,{allowUncertain:true})][1].values.c0,null);
});
test('input unchanged', () => {
  const data = [['姓名','金额'],['张三',10]];
  data.forEach(Object.freeze); Object.freeze(data);
  analyzeSheet(data);
  assert.deepEqual(data,[['姓名','金额'],['张三',10]]);
});
test('explicit unmerged multiheader with blank labels', () => {
  const table = first([['部门',null,'销售'],['名称',null,'金额'],['研发',null,10]],
    {regions:[{range:[0,0,2,2],headerRows:[0,1]}]});
  assert.equal(table.columns[1].name,'column_2');
  assert.equal(table.columns[2].name,'销售 / 金额');
});
test('invalid inputs, limits and ranges rejected', () => {
  assert.throws(() => analyzeSheet({}), TypeError);
  assert.throws(() => analyzeSheet([[1]],{merges:[[0,0,Infinity,1]]}),TypeError);
  assert.throws(() => analyzeSheet([[1]],{sampleRows:0}),TypeError);
  assert.throws(() => analyzeSheet([[1]],{regions:[[0,0,10001,1]]}),RangeError);
  assert.throws(() => analyzeSheet([[1]],{regions:[{range:[0,0,0,2],headerRows:[0,2]}]}),TypeError);
});
test('very distant sparse rows do not allocate a dense matrix', () => {
  const snapshot = {rows:[{index:100000000,children:[{index:2,meta:{value:1}}]}],cols:[]};
  assert.deepEqual(first(snapshot).range,[2,100000000,2,100000000]);
});
test('single cell and header-only sheets stay uncertain', () => {
  assert.ok(first([['报告']]).needsReview);
  assert.deepEqual(first([['姓名','金额']]).headerRows,[]);
});
test('100,000 rows: exact count and sum', () => {
  const data = [['姓名','金额']];
  for(let i=0;i<100000;i++) data.push(['用户'+i,i]);
  const started = performance.now();
  const table = first(data);
  const sum = [...iterateRecords(data,table)].reduce((s,r) => s+r.values.c1,0);
  assert.equal(table.rowCount,100000);
  assert.equal(sum,4999950000);
  console.log('100k rows analyze + extract:',Math.round(performance.now()-started),'ms');
});
test('three-level merged headers preserve paths', () => {
  const table = first([['地区','年度',null,null,null], [null,'上半年',null,'下半年',null],
    [null,'数量','金额','数量','金额'],['杭州',1,10,2,20]],
    {merges:[[0,0,0,2],[1,0,4,0],[1,1,2,1],[3,1,4,1]]});
  assert.deepEqual(table.headerRows,[0,1,2]);
  assert.equal(table.columns[4].name,'年度 / 下半年 / 金额');
});
test('explicit empty region cannot silently become trusted', () => {
  assert.ok(first([],{regions:[{range:[0,0,1,2],headerRows:[]}]}).needsReview);
});
test('deterministic generated offset fixtures preserve values and sums', () => {
  for (let seed=1;seed<=100;seed++) {
    const offset=seed%7, col=seed%5;
    const rows=[]; rows[offset]=Array(col).fill(null).concat(['姓名','金额']);
    let expected=0;
    for(let i=0;i<seed;i++) { const n=(i*37+seed)%101; expected+=n;
      rows[offset+i+1]=Array(col).fill(null).concat(['用户'+i,n]); }
    const table=first(rows);
    let actual=0;
    for(const record of iterateRecords(rows,table)) actual+=record.values['c'+(col+1)];
    assert.equal(actual,expected);
    assert.deepEqual(table.headerRows,[offset]);
    assert.equal(table.rowCount,seed);
  }
});
