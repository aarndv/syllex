import assert from "node:assert/strict";
import { test } from "node:test";
import { minimumLayoutSize, movePane, paneIds, paneRects, removePane, resizeSplit, splitDividers, splitPane } from "../src/utils/workspaceLayout.ts";

test("splits support rows, columns, and combined layouts", () => {
  let layout = splitPane(null, null, "a", "right");
  layout = splitPane(layout, "a", "b", "right");
  assert.equal(layout.axis, "row");
  layout = splitPane(layout, "b", "c", "bottom");
  assert.deepEqual(paneIds(layout), ["a", "b", "c"]);
  assert.equal(layout.second.axis, "column");
  layout = splitPane(layout, "c", "d", "left");
  assert.deepEqual(paneIds(layout), ["a", "b", "d", "c"]);
});

test("moving a pane preserves every view exactly once", () => {
  let layout = splitPane(null, null, "a", "right");
  layout = splitPane(layout, "a", "b", "right");
  layout = splitPane(layout, "b", "c", "right");
  layout = movePane(layout, "a", "c", "bottom");
  assert.deepEqual(paneIds(layout), ["b", "c", "a"]);
  assert.equal(layout.second.axis, "column");
  assert.equal(movePane(layout, "a", "a", "top"), layout);
  assert.equal(movePane(layout, "missing", "c", "left"), layout);
});

test("closing a pane collapses its split and allows an empty workspace", () => {
  const layout = splitPane(splitPane(null, null, "a", "right"), "a", "b", "bottom");
  assert.deepEqual(paneIds(removePane(layout, "a")), ["b"]);
  assert.equal(removePane(removePane(layout, "a"), "b"), null);
});

test("mixed tiles have stable pane identities and nonoverlapping positions", () => {
  let layout = splitPane(null, null, "a", "right");
  layout = splitPane(layout, "a", "b", "right");
  layout = splitPane(layout, "b", "c", "bottom");
  assert.deepEqual(paneRects(layout), {
    a: { left: 0, top: 0, width: 50, height: 100 },
    b: { left: 50, top: 0, width: 50, height: 50 },
    c: { left: 50, top: 50, width: 50, height: 50 },
  });
  assert.deepEqual(minimumLayoutSize(layout), { width: 380, height: 320 });
  const moved = movePane(layout, "a", "c", "right");
  assert.deepEqual(new Set(Object.keys(paneRects(moved))), new Set(["a", "b", "c"]));
});

test("resizing a nested divider changes only its two sides and preserves minimum pane size", () => {
  let layout = splitPane(null, null, "a", "right");
  layout = splitPane(layout, "a", "b", "right");
  layout = splitPane(layout, "b", "c", "bottom");
  const resized = resizeSplit(layout, "1", 0.7);
  assert.equal(splitDividers(resized).find((divider) => divider.path === "1")?.ratio, 0.7);
  assert.equal(splitDividers(resized).find((divider) => divider.path === "")?.ratio, 0.5);
  assert.deepEqual(paneRects(resized).c, { left: 50, top: 70, width: 50, height: 30 });
  assert.equal(resizeSplit(resized, "1", 1).second.ratio, 0.85);
  assert.ok(Math.abs(minimumLayoutSize(resized).height - 160 / 0.3) < 0.001);
});
