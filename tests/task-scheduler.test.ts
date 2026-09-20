import assert from "node:assert/strict";
import test from "node:test";
import { ConcurrentTaskScheduler } from "../lib/task-scheduler";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("runs at most three tasks and starts queued tasks in FIFO order", async () => {
  const scheduler = new ConcurrentTaskScheduler(3);
  const started: string[] = [];
  const controls = Array.from({ length: 5 }, deferred);

  controls.forEach((control, index) => {
    const id = `task-${index + 1}`;
    scheduler.enqueue({
      id,
      cancel: control.resolve,
      execute: async () => {
        started.push(id);
        await control.promise;
      },
    });
  });

  assert.deepEqual(started, ["task-1", "task-2", "task-3"]);
  assert.equal(scheduler.activeCount, 3);
  assert.equal(scheduler.queuedCount, 2);

  controls[0].resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["task-1", "task-2", "task-3", "task-4"]);

  scheduler.cancelAll();
});

test("cancelling a queued task skips it", async () => {
  const scheduler = new ConcurrentTaskScheduler(1);
  const first = deferred();
  let secondStarted = false;
  let queuedCancelled = false;

  scheduler.enqueue({ id: "first", cancel: first.resolve, execute: () => first.promise });
  scheduler.enqueue({
    id: "second",
    cancel: () => undefined,
    execute: async () => {
      secondStarted = true;
    },
    onQueuedCancel: () => {
      queuedCancelled = true;
    },
  });

  assert.equal(scheduler.cancel("second"), "queued");
  first.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(secondStarted, false);
  assert.equal(queuedCancelled, true);
});

test("cancelling a running task releases its slot", async () => {
  const scheduler = new ConcurrentTaskScheduler(1);
  const first = deferred();
  let secondStarted = false;

  scheduler.enqueue({ id: "first", cancel: first.resolve, execute: () => first.promise });
  scheduler.enqueue({
    id: "second",
    cancel: () => undefined,
    execute: async () => {
      secondStarted = true;
    },
  });

  assert.equal(scheduler.cancel("first"), "running");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(secondStarted, true);
});
