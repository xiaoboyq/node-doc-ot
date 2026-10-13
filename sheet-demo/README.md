# Sheet OT + ZRender local collaboration demo

This is an **independent development adapter**, not a replacement for the original Egg + Dubbo service. The original production service talks to an internal Dubbo snapshot store and its WebSocket gateway exists outside this repository.

## Run

From the repository root (which contains the checked-in `node_modules/@bzl` packages):

```bash
cd sheet-demo
npm install
npm run server    # terminal A: ws://localhost:8787
npm run dev       # terminal B: http://localhost:5173/?sheet=demo
```

Open the same address twice. Set a cell value and press Enter/提交单元格; each tab should receive the remote op and advance version. Insert rows and columns to test coordinate transformation. The demo server uses ShareDB's default memory DB, so **data is lost when the server restarts**.

## Reality checks

- Production OT: `@bzl/sheet-ottype@0.0.60`, registered on both endpoints, `update-cell` uses `at:[row,col], oldV, newV, id`. Validate this coordinate convention against actual production sheets.
- Real server uses `@boss/sharedb` and an internal Dubbo RPC receive/reply stream; the standalone server connects WebSockets directly and cannot access that production data.
- Current canvas paints the first visible rows/columns; scroll virtualization, drag selection, merged cells, clipboard, durable snapshots and robust reconnect/rebase tests remain future integration work.
- This code has **not been validated with an end-to-end browser run**. Run `npm run build` and open two tabs before treating it as complete.
- The repository currently includes private and historical dependency packages; isolate this demo from the production deployment and do not publish private credentials/configurations.

## Validation commands

Run `npm run build` and `npm test` before manual two-tab testing. See [VALIDATION.md](./VALIDATION.md) for expected scenarios and unresolved implementation gaps.
