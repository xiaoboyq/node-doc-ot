# Validation checklist (not yet passed)

The demo intentionally **does not claim a validated production implementation**. The current execution environment cannot connect to npm or GitHub over the network; GitHub edits were committed through the repository connector. To validate in a development machine with access to the private dependencies:

```bash
cd sheet-demo
npm install
npm run build
npm test
npm run server
# separate shell: npm run dev
```

Open http://localhost:5173/?sheet=demo in two tabs. Check:

1. Set B2 in browser A; browser B displays the same value and advances version.
2. Insert a row above row 1; existing B2 data moves to B3 on both.
3. Edit the same cell simultaneously and confirm both browsers converge.
4. Scroll vertically/horizontally and verify hit testing/editing aligns with the displayed cell.
5. Disconnect and reconnect; currently requires a page refresh; pending edits while offline are **not guaranteed to survive**.
6. Browser DevTools / TypeScript build should show no errors.

Production gaps: persistent snapshot/op store; recovery strategy; IME/editor overlay; merged cells; sizing/selection; permissions and presence; real gateway integration; concurrency load tests. Never connect the demo directly to the internal Dubbo infrastructure.
