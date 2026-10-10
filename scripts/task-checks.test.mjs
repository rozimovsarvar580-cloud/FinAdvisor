import assert from "node:assert/strict";
import test from "node:test";
import { parseTasks, hasMachineChecks, taskNeeds, runTaskChecks, markTasksDone } from "./task-checks.mjs";

test("parses task status, stage, and machine checks", () => {
  const tasks = parseTasks([
    "# Tasks",
    "## Stage A",
    "- [ ] A1 First task",
    "  - exists: package.json",
    "  - needs: H1, A0",
    "- [x] A2 Second task",
    "  - done: prose only",
  ].join("\n"));

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].stage, "Stage A");
  assert.equal(tasks[0].done, false);
  assert.equal(hasMachineChecks(tasks[0]), true);
  assert.deepEqual(taskNeeds(tasks[0]), ["H1", "A0"]);
  assert.equal(tasks[1].done, true);
  assert.equal(hasMachineChecks(tasks[1]), false);
});

test("runs supported task checks and expands the Python command", () => {
  const commands = [];
  const task = {
    body: [
      "- exists: package.json",
      "- absent: scripts/__task-checks-missing__.tmp",
      "- contains: package.json :: \"name\"",
      "- not-contains: package.json :: impossible-task-check-text",
      "- cmd: {{PY}} -m example",
    ],
  };

  const problems = runTaskChecks(task, {
    root: process.cwd(),
    python: "python-test",
    runCommand: (command) => {
      commands.push(command);
      return { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.deepEqual(problems, []);
  assert.deepEqual(commands, ["python-test -m example"]);
});

test("reports failed commands and malformed text checks", () => {
  const problems = runTaskChecks(
    { body: ["- contains: package.json", "- cmd: exit 1"] },
    {
      root: process.cwd(),
      runCommand: () => ({ status: 1, stdout: "", stderr: "failed" }),
    },
  );

  assert.equal(problems.length, 2);
  assert.match(problems[0], /invalid contains check/);
  assert.match(problems[1], /command failed: exit 1/);
});

test("marks only specified incomplete tasks and preserves line endings", () => {
  const text = "- [ ] A1 First\r\n- [x] A2 Second\r\n";
  assert.equal(markTasksDone(text, ["A1", "A2"]), "- [x] A1 First\r\n- [x] A2 Second\r\n");
  assert.equal(markTasksDone(text, []), text);
});
