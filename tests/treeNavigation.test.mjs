import assert from "node:assert/strict";
import { test } from "node:test";
import { getTreeNavigation, getVisibleTreeNodes } from "../src/utils/treeNavigation.ts";

const file = (name, path) => ({ name, relative_path: path, node_type: { File: "Pdf" }, children: [] });
const folder = (name, path, children = []) => ({ name, relative_path: path, node_type: "Folder", children });
const nodes = [
  folder("Course", "Course", [
    file("Intro.pdf", "Course/Intro.pdf"),
    folder("Week 1", "Course/Week 1", [file("Notes.pdf", "Course/Week 1/Notes.pdf")]),
    folder("Empty", "Course/Empty"),
  ]),
  file("General.pdf", "General.pdf"),
];

test("visible rows skip collapsed descendants and include empty folders", () => {
  const collapsed = getVisibleTreeNodes(nodes, new Set());
  assert.deepEqual(collapsed.map(({ node }) => node.relative_path), ["Course", "General.pdf"]);

  const expanded = getVisibleTreeNodes(nodes, new Set(["Course", "Course/Week 1"]));
  assert.deepEqual(expanded.map(({ node }) => node.relative_path), [
    "Course", "Course/Intro.pdf", "Course/Week 1", "Course/Week 1/Notes.pdf",
    "Course/Empty", "General.pdf",
  ]);
  assert.equal(expanded[3].parentPath, "Course/Week 1");
});

test("arrows and boundary keys navigate nested, empty, and file rows", () => {
  const expandedPaths = new Set(["Course", "Course/Week 1", "Course/Empty"]);
  const visible = getVisibleTreeNodes(nodes, expandedPaths);
  const move = (path, key) => getTreeNavigation(visible, path, key, expandedPaths);

  assert.deepEqual(move("Course", "ArrowRight"), { focusPath: "Course/Intro.pdf" });
  assert.deepEqual(move("Course/Intro.pdf", "ArrowLeft"), { focusPath: "Course" });
  assert.deepEqual(move("Course/Week 1", "ArrowDown"), { focusPath: "Course/Week 1/Notes.pdf" });
  assert.deepEqual(move("Course/Empty", "ArrowRight"), { focusPath: undefined });
  assert.deepEqual(move("Course/Empty", "ArrowLeft"), { togglePath: "Course/Empty" });
  assert.deepEqual(move("General.pdf", "Home"), { focusPath: "Course" });
  assert.deepEqual(move("Course", "End"), { focusPath: "General.pdf" });
  assert.deepEqual(move("General.pdf", "ArrowDown"), { focusPath: "General.pdf" });
  assert.deepEqual(move("General.pdf", "ArrowRight"), {});
});
