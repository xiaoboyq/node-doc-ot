'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSheet, iterateRecords } = require('../../lib/sheet-analysis');
function place(matrix, top, left, block) {
  block.forEach((row,r) => row.forEach((v,c) => {
    if (!matrix[top+r]) matrix[top+r]=[];
    matrix[top+r][left+c]=v;
  }));
}
function basic(count, offset=0) {
  return [['姓名','金额'], ...Array.from({length:count},(_,i)=>['用户'+i,i+offset])];
}
function ranges(result) { return result.tables.map(t=>t.range); }

test('A1:D20 long table, F3:H8 and F12:H25 independent tables', () => {
  const data=[];
  place(data,0,0,[['姓名','数量','金额','状态'], ...Array.from({length:19},(_,i)=>['A'+i,i,i*2,'正常'])]);
  place(data,2,5,[['产品','数量','金额'], ...Array.from({length:5},(_,i)=>['B'+i,i,i*3])]);
  place(data,11,5,[['产品','数量','金额'], ...Array.from({length:13},(_,i)=>['C'+i,i,i*4])]);
  const result=analyzeSheet(data);
  assert.deepEqual(ranges(result),[[0,0,3,19],[5,2,7,7],[5,11,7,24]]);
  assert.deepEqual(result.tables.map(t=>t.rowCount),[19,5,13]);
  assert.deepEqual(result.tables.map(t=>t.headerRows),[[0],[2],[11]]);
});
test('horizontal long table beside multiple vertically stacked blocks, recursively trimmed', () => {
  const data=[];
  place(data,0,0,basic(10)); place(data,0,4,basic(2)); place(data,6,4,basic(3));
  const result=analyzeSheet(data);
  assert.deepEqual(ranges(result),[[0,0,1,10],[4,0,5,2],[4,6,5,9]]);
});
test('single full-width title spans three independent small tables', () => {
  const data=[['经营总览']];
  place(data,1,0,basic(8)); place(data,2,4,basic(2)); place(data,7,4,basic(2));
  const result=analyzeSheet(data,{merges:[[0,0,5,0]]});
  assert.deepEqual(ranges(result),[[0,1,1,9],[4,2,5,4],[4,7,5,9]]);
  assert.equal(result.sectionTitles.length,1);
  assert.equal(result.sectionTitles[0].text,'经营总览');
  assert.deepEqual(result.sectionTitles[0].tableRanges,ranges(result));
});
test('two shared report title rows do not become tables', () => {
  const data=[['年度报表'],['单位：元']]; place(data,2,0,basic(2)); place(data,2,4,basic(3));
  const result=analyzeSheet(data,{merges:[[0,0,5,0],[0,1,5,1]]});
  assert.equal(result.tables.length,2);
  assert.equal(result.sectionTitles.length,2);
  assert.deepEqual(result.tables.map(t=>t.headerRows),[[2],[2]]);
});
test('merged multirow header keeps blank intermediate header rows in one region', () => {
  const data=[['地区','销售',null], [], [null,'数量','金额'],['杭州',1,10]];
  const result=analyzeSheet(data,{merges:[[0,0,0,2],[1,0,2,1]]});
  assert.equal(result.tables.length,1);
  assert.deepEqual(result.tables[0].headerRows,[0,1,2]);
  assert.deepEqual(result.tables[0].columns[1].path,['销售','数量']);
});
test('unequal-depth nested header: leaf spans, vertical spans, four rows', () => {
  const data=[['地区','年度',null,null,null,'负责人'],
    [null,'上半年',null,'下半年',null,null],
    [null,'数量','金额','销量',null,null],
    [null,null,null,'线上','线下',null],
    ['杭州',2,20,3,4,'张三'],['上海',5,50,6,7,'李四']];
  const merges=[[0,0,0,3],[1,0,4,0],[5,0,5,3],[1,1,2,1],[3,1,4,1],
    [1,2,1,3],[2,2,2,3],[3,2,4,2]];
  const table=analyzeSheet(data,{merges}).tables[0];
  assert.deepEqual(table.headerRows,[0,1,2,3]);
  assert.deepEqual(table.columns.map(c=>c.name),['地区','年度 / 上半年 / 数量','年度 / 上半年 / 金额',
    '年度 / 下半年 / 销量 / 线上','年度 / 下半年 / 销量 / 线下','负责人']);
  assert.equal(table.headerTree.length,3);
  assert.equal(table.headerTree[1].children[1].children[0].children[1].label,'线下');
  assert.deepEqual(table.dataRows,[4,5]);
  assert.ok(!table.warnings.includes('MISSING_HEADER_LEAF'));
});
test('identical labels at different levels retain distinct nodes and paths', () => {
  const data=[['销售','销售'],['销售','金额'],[10,20]];
  const result=analyzeSheet(data,{regions:[{range:[0,0,1,2],headerRows:[0,1]}]});
  assert.deepEqual(result.tables[0].columns[0].path,['销售','销售']);
  assert.equal(result.tables[0].headerTree[0].children[0].label,'销售');
});
test('crossing child groups require review instead of silently inventing a hierarchy', () => {
  const data=[['地区','上半年',null,'下半年',null],[null,'数量','跨组',null,'金额'],['杭州',1,2,3,4]];
  const result=analyzeSheet(data,{merges:[[0,0,0,1],[1,0,2,0],[3,0,4,0],[2,1,3,1]]});
  assert.ok(result.tables[0].warnings.includes('CROSSING_HEADER_GROUPS'));
  assert.ok(result.needsReview);
  assert.throws(()=>[...iterateRecords(data,result.tables[0])],/Review/);
});
test('overlapping merge metadata requires review', () => {
  const result=analyzeSheet([['姓名','金额'],['甲',1]],{merges:[[0,0,1,0],[1,0,1,1]]});
  assert.ok(result.warnings.includes('OVERLAPPING_MERGES'));
  assert.ok(result.needsReview);
});
test('missing header leaf is reported', () => {
  const data=[['地区','销售',null],[null,'数量',null],['杭州',1,20]];
  const table=analyzeSheet(data,{merges:[[0,0,0,1],[1,0,2,0]]}).tables[0];
  assert.ok(table.warnings.includes('MISSING_HEADER_LEAF'));
});
test('header depth beyond configured limit cannot be trusted', () => {
  const data=[['地区','销售',null],[null,'季度',null],[null,'数量','金额'],['杭州',1,2]];
  const result=analyzeSheet(data,{merges:[[0,0,0,2],[1,0,2,0],[1,1,2,1]],maxHeaderRows:2});
  assert.ok(result.tables[0].warnings.includes('HEADER_DEPTH_UNCERTAIN'));
  assert.ok(result.needsReview);
});
test('explicit region cutting through merged header is flagged', () => {
  const data=[['姓名','销售',null],['甲',1,2]];
  const result=analyzeSheet(data,{merges:[[1,0,2,0]],regions:[{range:[0,0,1,1],headerRows:[0]}]});
  assert.ok(result.tables[0].warnings.includes('HEADER_MERGE_CROSSES_BOUNDARY'));
});
test('format-only distant empty merge does not expand sheet bounds', () => {
  const result=analyzeSheet(basic(2),{merges:[[100000,100000,200000,200000]]});
  assert.deepEqual(ranges(result),[[0,0,1,2]]);
});
test('recursive partition depth guard reports incomplete analysis', () => {
  const data=[];place(data,0,0,basic(6));place(data,0,4,basic(1));place(data,4,4,basic(1));
  const result=analyzeSheet(data,{maxRegionDepth:1});
  assert.ok(result.warnings.includes('REGION_DEPTH_LIMIT'));
});
test('project sparse snapshot with shared title, mixed headers and three tables', () => {
  const matrix=[['经营总览']]; place(matrix,1,0,basic(8));place(matrix,2,4,basic(2));place(matrix,7,4,basic(2));
  const rows=[];
  matrix.forEach((row,r)=>rows.push({index:r,children:row.map((value,c)=>({index:c,meta:{value}})).filter(Boolean)}));
  const result=analyzeSheet({data:{rows,cols:[]},config:{merge:{title:[0,0,5,0]}}});
  assert.equal(result.tables.length,3);
  assert.equal(result.sectionTitles[0].text,'经营总览');
});
test('60 generated staggered layouts preserve exact regions, rows, sums', () => {
  for(let seed=1;seed<=60;seed++) {
    const data=[], top=seed%4, left=seed%3, n=seed%6+1;
    place(data,top,left,basic(n*2+5));
    place(data,top+1,left+4,basic(n,seed));
    place(data,top+n+4,left+4,basic(n,seed*2));
    const result=analyzeSheet(data);
    assert.equal(result.tables.length,3);
    assert.deepEqual(result.tables.map(t=>t.rowCount),[n*2+5,n,n]);
    const sum=[...iterateRecords(data,result.tables[2])].reduce((s,r)=>s+r.values['c'+(left+5)],0);
    assert.equal(sum,n*(n-1)/2+seed*2*n);
  }
});
test('repeated multirow header is excluded as a complete block', () => {
  const data=[['地区','销售',null],[null,'数量','金额'],['杭州',1,10],
    ['地区','销售',null],[null,'数量','金额'],['上海',2,20]];
  const merges=[[0,0,0,1],[1,0,2,0],[0,3,0,4],[1,3,2,3]];
  const table=analyzeSheet(data,{merges}).tables[0];
  assert.deepEqual(table.repeatedHeaderRows,[3,4]);
  assert.deepEqual(table.dataRows,[2,5]);
  assert.ok(!table.warnings.includes('MERGED_BODY_REQUIRES_REVIEW'));
});
test('adjacent different tables without separator are flagged, explicit regions resolve them', () => {
  const data=[['姓名','金额'],['甲',1],['产品','数量'],['笔',2]];
  const auto=analyzeSheet(data);
  assert.ok(auto.tables[0].warnings.includes('POSSIBLE_INTERNAL_HEADER'));
  assert.deepEqual(auto.tables[0].internalHeaderRows,[2]);
  const manual=analyzeSheet(data,{regions:[{range:[0,0,1,1],headerRows:[0]},{range:[0,2,1,3],headerRows:[2]}]});
  assert.equal(manual.tables.length,2);
  assert.equal(manual.needsReview,false);
});
test('blank reserved column retained by explicit region instead of forced splitting', () => {
  const data=[['姓名',null,'金额'],['甲',null,1]];
  const result=analyzeSheet(data,{regions:[{range:[0,0,2,1],headerRows:[0]}]});
  assert.equal(result.tables.length,1);
  assert.equal(result.tables[0].columns.length,3);
  assert.ok(result.tables[0].warnings.includes('MISSING_HEADER_LEAF'));
});
test('global merge warnings also block per-table extraction', () => {
  const data=[['姓名','金额'],['甲',1]];
  const options={merges:[[0,0,1,0],[1,0,1,1]]};
  const table=analyzeSheet(data,options).tables[0];
  assert.ok(table.needsReview);
  assert.throws(()=>[...iterateRecords(data,table)],/Review/);
});
test('shared title separated by a blank row still belongs to sub-tables', () => {
  const data=[['总览']];place(data,2,0,basic(5));place(data,3,4,basic(2));
  const result=analyzeSheet(data,{merges:[[0,0,5,0]]});
  assert.equal(result.tables.length,2);
  assert.equal(result.sectionTitles.length,1);
  assert.deepEqual(result.tables.map(t=>t.headerRows),[[2],[3]]);
});
test('single table title separated by blank rows stays attached to its table', () => {
  const data=[['报表']];place(data,3,0,basic(2));
  const result=analyzeSheet(data,{merges:[[0,0,1,0]]});
  assert.equal(result.tables.length,1);
  assert.deepEqual(result.tables[0].titleRows,[0]);
  assert.deepEqual(result.tables[0].headerRows,[3]);
  assert.deepEqual(result.tables[0].dataRows,[4,5]);
});
test('runnable realistic report combines richtext sparse data, nested header and unrelated tables', () => {
  const {createReport}=require('../../examples/sheet-analysis/complex-report');
  const result=analyzeSheet(createReport());
  assert.deepEqual(ranges(result),[[0,2,5,15],[8,3,10,5],[8,10,10,13]]);
  assert.deepEqual(result.tables.map(t=>t.rowCount),[10,2,3]);
  assert.equal(result.sectionTitles[0].text,'2026 年度经营报表');
  assert.equal(result.tables[0].columns[4].name,'年度 / 下半年 / 销量 / 线下');
  const records=[...iterateRecords(createReport(),result.tables[0])];
  assert.equal(records.reduce((sum,r)=>sum+r.values.c2,0),5500);
});
