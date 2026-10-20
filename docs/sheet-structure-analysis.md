# Sheet 表头与表结构识别

实现：`lib/sheet-analysis/index.js`，CommonJS、零新增依赖。直接读取二维数组，或项目 `@bzl/sheet-js` 的 `{data:{rows,cols},config:{merge,style}}` 快照。不会修改快照、发送 OP、调用模型或执行公式。

## 使用

```js
const { analyzeSheet, iterateRecords } = require('./lib/sheet-analysis');
const data = [['姓名', '金额'], ['张三', 10], ['李四', 20]];
const result = analyzeSheet(data);
const table = result.tables[0];
if (result.needsReview) throw new Error('需要确认表格边界或表头');
let total = 0;
for (const record of iterateRecords(data, table)) total += record.values.c1;
// total === 30
```

传入 OT 快照时使用解密解压后的 `snapshot.data`（该字段必须是包含 data/config 的 Sheet 对象），不要把整个 ShareDB Snapshot 包装对象传入。调用方必须先校验访问权限；本模块不读取数据库、不做权限判断。应分析同一个确定版本的不可变快照；协同更新后重新分析，不能拿旧坐标读新版本。

## 规则与输出

1. 归一化：保留 0、false、数字类型和绝对行列坐标；富文本提取可见文本；稀疏结构不展开成完整矩阵。
2. 区域：先按空行分段，每段再按全空列拆分。`blankRowTolerance` 可容忍表内空行；默认 0。
3. 标题：只有全宽、单行合并且仅一个非空值时才作为标题跳过。
4. 表头：结合中英文关键词、文本到数字/布尔/日期的类型变化、粗体变化、合并结构累积分数；证据不足时保留首行作为数据，标记待确认。
5. 多级表头：沿连续合并带构建列路径，例如 `年度 / 下半年 / 金额`，默认最多 6 行。只在表头传播合并锚点文本，不自动填充正文。
6. 列：输出 `index/key/name/path/type/typeCounts`。`key` 使用绝对列号 `c0/c1`，重复列名不会覆盖数据。数字字符串、前导零编码、金额字符串不隐式转数字。
7. 行：输出 `titleRows/headerRows/dataRows/summaryRows/repeatedHeaderRows`。疑似合计与单层重复表头不进入 dataRows；合计行必须人工复核，避免真实数据被误排除。
8. 质量：`confidence` 是规则分数，不是校准概率；`reasons/warnings/needsReview` 用于确认流程。仅靠类型变化识别的自定义表头仍需确认。`iterateRecords` 默认拒绝待确认结果。

所有范围统一为 **零基、闭区间 `[left, top, right, bottom]`**，与项目 Range 一致；`headerRows` 是绝对行号。

## 显式指定，处理歧义

```js
const result = analyzeSheet(data, {
  regions: [{ range: [0, 0, 1, 2], headerRows: [0] }],
});
// headerRows: [] 明确表示无表头；[0,1] 表示两层表头。
// 明确 regions 后，区域内部的全空列不会被自动拆开。
```

可选项：`merges`（Range 数组）、`getValue(cell,row,col)`（公式缓存或其他单元格格式适配）、`getStyle(row,col)`（业务端解析后的样式）、`sampleRows=30`、`maxHeaderRows=6`、`maxColumns=10000`、`blankRowTolerance=0`。

项目公式字段只有公式表达式时，不猜测计算值，报告 `FORMULA_RESULT_MISSING`。扩展单元格 `{formula:true,value:'=1+2',result:3}` 可读取 result；实际业务可通过 getValue 接入公式引擎的已计算值。相同适配选项也要传给 iterateRecords。

## 支持边界

这是确定性启发式识别器，不是能理解任意报表语义的模型：

- 无空白隔断的相邻表、交错布局、正文中的说明段、无合并的多级表头、交叉透视表，需要显式 regions/headerRows。
- 全空列可能是表内预留字段，也可能是分隔符；默认拆分，需要业务确认。全宽标题跨越多个并排表时，也应显式分区。
- 普通文本标题无可靠元数据时不会擅自删除；全是文本的第一行，不能仅凭位置确定是字段名。
- 背景色、边框、冻结行不是决定性证据；当前只利用显式粗体变化，其他样式可作为后续候选评分的扩展。项目行列继承样式需要 getStyle 解析。
- 正文合并不自动向下填充；隐藏行仍参与分析，不隐式等同于筛选后的可见行。
- 稀疏行列默认值不展开，发现时报告 `SPARSE_DEFAULT_VALUES_NOT_EXPANDED`，应先由业务适配明确有限范围。
- `allowUncertain:true` 是调用方确认后显式放行；会按识别出的 dataRows 提取，不能自动修复错误分区。应优先通过 regions/headerRows 重新分析纠正。

## 性能与接入

归一化内存与已存储单元格数相关，单表后续扫描约 O(行数×列数)，不会按最大稀疏坐标分配矩阵。多个区域会重复筛选行；海量碎片化布局应显式提供范围并分批处理。记录接口逐条 yield，但归一化仍需建立索引，并非全流程 O(1) 内存。

不要放在 OT apply/transform 的同步关键路径中。大表应在 Worker Thread 或后台任务上执行，从指定版本读取一次快照。无需在本次功能中改动现有 OT/鉴权链路。

## 测试

```sh
npm run test:sheet-analysis
```

独立测试使用 Node.js 18+ 的内置 test runner；业务模块保持项目 CommonJS 风格，不增加运行时依赖。旧项目声明 Node >=10，本次未在 Node 10 实际验证。测试文件使用 `.node-test.js`，避免混入 Egg 默认 `.test.js` 测试发现。

覆盖普通/无表头/纯文本歧义、多级合并表头、标题、多区域、空行空列、重复字段、汇总、公式、富文本稀疏快照、极大坐标、类型混杂、输入不变性和参数校验；另含 10 万行精确求和及 100 组坐标偏移回归。
