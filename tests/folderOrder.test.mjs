import assert from "node:assert/strict";
import { test } from "node:test";
import { moveSiblingFolder, sortSiblingFolders } from "../src/utils/folderOrder.ts";

const folder = (relative_path) => ({ relative_path, node_type: "Folder" });

test("saved order applies to siblings and leaves new folders in scan order", () => {
  const folders = [folder("Course/A"), folder("Course/B"), folder("Course/C")];
  assert.deepEqual(sortSiblingFolders(folders, ["Course/C", "Course/A"]).map((item) => item.relative_path), ["Course/C", "Course/A", "Course/B"]);
  assert.deepEqual(folders.map((item) => item.relative_path), ["Course/A", "Course/B", "Course/C"]);
});

test("portable slash paths match Windows scan paths", () => {
  const folders = [folder("Course\\A"), folder("Course\\B")];
  assert.deepEqual(sortSiblingFolders(folders, ["Course/B", "Course/A"]).map((item) => item.relative_path), ["Course\\B", "Course\\A"]);
});

test("move before and after keeps the same sibling paths", () => {
  const paths = ["A", "B", "C"];
  assert.deepEqual(moveSiblingFolder(paths, "C", "A", "before"), ["C", "A", "B"]);
  assert.deepEqual(moveSiblingFolder(paths, "A", "C", "after"), ["B", "C", "A"]);
  assert.deepEqual(paths, ["A", "B", "C"]);
});
