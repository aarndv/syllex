import assert from "node:assert/strict";
import { test } from "node:test";
import { getTooltipPosition } from "../src/utils/tooltipPosition.ts";

test("keeps measured tooltips inside the viewport at every corner", () => {
  for (const viewport of [
    { left: 0, top: 0, width: 800, height: 600 },
    { left: 30, top: 20, width: 300, height: 220 },
  ]) {
    for (const tooltip of [
      { width: 80, height: 40 },
      { width: 260, height: 100 },
      { width: 180, height: 190 },
    ]) {
      for (const pointer of [
        { x: viewport.left + 2, y: viewport.top + 2 },
        { x: viewport.left + viewport.width - 2, y: viewport.top + 2 },
        { x: viewport.left + 2, y: viewport.top + viewport.height - 2 },
        { x: viewport.left + viewport.width - 2, y: viewport.top + viewport.height - 2 },
      ]) {
        const position = getTooltipPosition(pointer, tooltip, viewport);
        assert.ok(position.x >= viewport.left + 8);
        assert.ok(position.y >= viewport.top + 8);
        assert.ok(position.x + tooltip.width <= viewport.left + viewport.width - 8);
        assert.ok(position.y + tooltip.height <= viewport.top + viewport.height - 8);
      }
    }
  }
});

test("flips a tooltip above and left when the pointer is near the lower-right edge", () => {
  const pointer = { x: 790, y: 590 };
  const position = getTooltipPosition(pointer, { width: 260, height: 112 }, {
    left: 0, top: 0, width: 800, height: 600,
  });
  assert.ok(position.x < pointer.x);
  assert.ok(position.y < pointer.y);
});
