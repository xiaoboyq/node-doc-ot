# 在线协同 Sheet（React + ZRender + ShareDB）

在 `feat/sheet-web-collaboration` 分支继续原有 `sheet-demo`，保留仓库原 Egg + Dubbo 服务。此目录是可以独立运行的内存协同应用，不连接内部生产快照服务。

## 启动

使用 Node.js 20.19+ 或 22.12+，在仓库根目录执行：

```bash
git switch feat/sheet-web-collaboration
cd sheet-demo
npm ci
npm run build
npm run server
```

打开 `http://localhost:8787/?sheet=demo`，在两个窗口打开同一地址即可协同。构建后的页面由 Node 同源提供，WebSocket 使用 `/collaboration`。健康检查：`http://localhost:8787/health`。`SHEET_DEMO_PORT` 可修改 Node 端口。

开发模式在另一终端运行 `npm run dev`，打开 `http://localhost:5173/?sheet=demo`；Vite 将 WebSocket 代理到 8787。受限容器若无法读取网络接口，使用 `npm run dev -- --host 127.0.0.1`。

请只在 `sheet-demo` 安装依赖；父目录已提交的私有依赖由 `file:` 复用，勿用根目录安装覆盖它们。

## 操作

- 单击选择；拖动或 Shift 单击选择矩形区域。方向键移动，Shift + 方向键扩大选区。
- 双击单元格或按 Enter 聚焦编辑栏；Enter/提交按钮保存，Escape 撤销尚未提交的输入。输入法组合中的 Enter 不提交。
- 插入行/列在当前单元格之前插入，选区随逻辑单元格移动。
- 合并保留左上角显示值，其他单元格内容保留，拆分后恢复显示。点击合并区域编辑左上角；合并/拆分通过真实 `update-merge` OP 协同。
- WebSocket 断开自动退避重连；同一页面内保留 ShareDB pending/inflight 和原 `src/seq`，依赖 ShareDB 回放、Transform 与服务端去重。

## 实现

Web 与 Node 统一通过 `ot-type.cjs` 注册 `@bzl/sheet-ottype@0.0.60`，仅添加 ShareDB 所需 URI，原 apply/transform 函数保持不变。底层数据操作复用 `@bzl/sheet-js`。单元格坐标为 `[row,column]`；合并范围为 `[column,row,column,row]`，测试使用非对称坐标防止混淆。

生产 `@boss/sharedb` 的 subscribe 不返回快照（原生产快照来自 Dubbo）；独立 `backend.cjs` 只对 demo 实例补回首次快照和重连 OP 回放，不改 npm 包及原服务。保留原 ShareDB 服务端 OP 队列。

画布复用 ZRender 实例，显式注册 CanvasPainter，按可视区绘制并裁剪冻结表头，动画帧合并快照刷新和绘制；稀疏单元格索引用 Map。行列数量来自 OT 快照 config，插入后滚动范围同步增长。

## 测试

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
SHEET_BUILT=1 npm run test:e2e
```

Playwright 自动启动并停止 Node 与 Vite 服务。测试涵盖双窗口、同版本并发两种到达顺序、断网待提交编辑、丢 ACK 重发、合并拆分、草稿保护、选区、IME、Canvas 实例与虚拟渲染。详见 [VALIDATION.md](./VALIDATION.md)。

## 边界

内存快照与 OP 历史在服务重启后丢失；页面刷新会丢失尚未确认的本地操作。未接入鉴权、持久化或生产 Dubbo，未实现公式计算、撤销重做、剪贴板与 Excel 导入导出。未进行 100MB 快照或高并发压测。当前生产构建仍有约 1.4MB 主包的体积提示，应在生产集成时进一步拆包。PR 保持 Draft，供独立 demo 验证与后续生产集成评审。
