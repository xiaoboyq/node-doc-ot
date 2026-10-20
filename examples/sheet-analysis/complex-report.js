'use strict';
const { analyzeSheet } = require('../../lib/sheet-analysis');

// A report title, an uneven four-level sales header on the left,
// two unrelated tables at different vertical offsets on the right.
function createReport() {
  const matrix = [];
  function place(top, left, rows) {
    rows.forEach((row, r) => row.forEach((value, c) => {
      if (!matrix[top + r]) matrix[top + r] = [];
      matrix[top + r][left + c] = value;
    }));
  }
  place(0, 0, [[ '2026 年度经营报表' ]]);
  place(2, 0, [
    [ '地区', '年度', null, null, null, '负责人' ],
    [ null, '上半年', null, '下半年', null, null ],
    [ null, '数量', '金额', '销量', null, null ],
    [ null, null, null, '线上', '线下', null ],
    ...Array.from({ length: 10 }, (_, i) => [ '区域' + (i + 1), i + 1, (i + 1) * 100, i + 2, i + 3, '负责人' + i ]),
  ]);
  place(3, 8, [[ '产品', '数量', '金额' ], [ '键盘', 3, 600 ], [ '鼠标', 5, 250 ]]);
  place(10, 8, [[ '部门', '姓名', '状态' ], [ '研发', '张三', '在岗' ], [ '销售', '李四', '出差' ], [ '客服', '王五', '在岗' ]]);
  const merge = {
    reportTitle: [ 0, 0, 10, 0 ], region: [ 0, 2, 0, 5 ], year: [ 1, 2, 4, 2 ], owner: [ 5, 2, 5, 5 ],
    firstHalf: [ 1, 3, 2, 3 ], secondHalf: [ 3, 3, 4, 3 ], quantity: [ 1, 4, 1, 5 ],
    amount: [ 2, 4, 2, 5 ], channels: [ 3, 4, 4, 4 ],
  };
  const rows = [];
  matrix.forEach((row, r) => {
    const children = [];
    row.forEach((value, c) => {
      if (value != null) {
        children.push({ index: c, meta: typeof value === 'string' ?
          { type: 'richtext', value: [{ children: [{ text: value }] }] } : { value } });
      }
    });
    rows.push({ index: r, children });
  });
  return { data: { rows, cols: [] }, config: { merge } };
}
if (require.main === module) {
  const result = analyzeSheet(createReport());
  console.log(JSON.stringify(result, null, 2));
}
module.exports = { createReport };
