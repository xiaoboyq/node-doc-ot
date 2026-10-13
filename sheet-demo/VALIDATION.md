# 实际验证记录

验证日期：2026-10-13。环境：Node 24.19.0，npm 11.9.0，Playwright 1.51.1，Chromium 134，Linux headless。

## 已执行结果

| 命令 | 结果 |
| --- | --- |
| `npm install` / `npm ci --no-audit --no-fund` | 依赖安装成功，已提交 lockfile |
| `npm run build` | TypeScript 检查和 Vite 生产构建成功 |
| `npm test` | 6/6 Node 测试通过 |
| `npm run test:e2e` | 6/6 Chromium 开发模式测试通过 |
| `SHEET_BUILT=1 npm run test:e2e` | 6/6 Chromium 构建产物测试通过 |

浏览器测试真实启动 Node + Web，连接实际 WebSocket；生产模式访问 Node 提供的 dist 页面，不只检查构建命令。没有将未执行的生产集成、持久化或压测算作通过。

## Node 用例

1. 共用 OT 适配器保持原包 apply/transform 函数引用，仅补 URI。
2. 同版本插入行 + 非对称 `[2,4]` 编辑，客户端数据与版本收敛。
3. 同版本插入列 + 非对称编辑，坐标偏移正确。
4. 同格并发与连续 pending 操作最终收敛。
5. 合并范围按 `[column,row,column,row]` 表示，插入后偏移、拆分后删除。
6. 原有单元格编辑和插入行 smoke test。

## 浏览器用例

1. 两窗口非对称坐标编辑；远端更新保留未提交草稿；行列插入；合并拆分；滚动后确实绘制下方可视区且绘制单元格少于 400。
2. 一个窗口离线编辑，另一窗口插入行；重连后本地 pending 内容位于正确逻辑单元格，版本一致。
3. 拦截服务端提交 ACK 并断开连接，期间另一窗口插入列；原 src/seq 重发后不重复插入，数据与版本一致，后续编辑继续协同。
4. 拦截两窗口出站 OP，确认相同基础版本，控制插入先到服务端，验证 Transform 和最终坐标。
5. 同上，控制编辑先到服务端，验证另一种顺序。
6. 拖动选区、方向键、Enter 聚焦与保存、IME composing Enter 不提交、Escape 取消、Canvas DOM 节点在编辑后保持原实例。

## 修复与非阻断日志

- 首轮 Node 测试因 SheetOTType 缺少 URI，创建报 Missing create type；已修复。
- 生产 ShareDB fork 订阅不返回快照；独立适配器补回快照与 OP 回放。
- Vite 开发模式本地 CommonJS 注册模块未转换导致白屏；显式预打包共用注册模块。
- Vite 构建把 events 外部化；使用浏览器 events 包别名。
- 生产打包移除隐式 Canvas 注册；显式注册 CanvasPainter。
- 测试对远端拆分点击过早；先等待 ACK 与对方版本同步，再验证选区。
- 受限环境读取网络接口失败，Vite 使用 `--host 127.0.0.1` 正常启动。
- Playwright 首个 CDN 下载返回非 ZIP，备用微软下载源成功安装 Chromium。
- 故意断开连接、React StrictMode 清理和测试关闭窗口时，Vite 代理可能记录 EPIPE / ECONNRESET；Node 未崩溃，重连测试通过。构建产物直连 Node 测试没有 Vite 代理。
- 构建主 JS 约 1.42MB / gzip 411KB，存在非阻断 chunk size 提示。

## 尚未验证 / 非本次范围

真实 Egg/Dubbo 内部网关集成、生产鉴权和授权、持久化恢复、刷新后的离线操作恢复、100MB 快照及高并发压测、Safari/Firefox、真实操作系统输入法交互。IME 测试验证浏览器 composing 事件逻辑，不冒充真人输入法测试。内存服务重启会丢失快照和操作历史。PR 保持 Draft。
