export type ScheduledTask = {
  id: string;
  execute: () => Promise<void>;
  cancel: () => void;
  onQueuedCancel?: () => void;
};

export class ConcurrentTaskScheduler {
  private readonly active = new Map<string, ScheduledTask>();
  private readonly queue: ScheduledTask[] = [];

  constructor(private readonly limit = 3) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("并发数必须是正整数");
    }
  }

  enqueue(task: ScheduledTask) {
    if (
      this.active.has(task.id) ||
      this.queue.some((queuedTask) => queuedTask.id === task.id)
    ) {
      throw new Error(`任务 ${task.id} 已在调度器中`);
    }
    this.queue.push(task);
    this.pump();
  }

  cancel(id: string): "queued" | "running" | undefined {
    const queuedIndex = this.queue.findIndex((task) => task.id === id);
    if (queuedIndex >= 0) {
      const [task] = this.queue.splice(queuedIndex, 1);
      task.cancel();
      task.onQueuedCancel?.();
      return "queued";
    }

    const activeTask = this.active.get(id);
    if (activeTask) {
      activeTask.cancel();
      return "running";
    }
    return undefined;
  }

  cancelAll() {
    for (const task of this.queue.splice(0)) {
      task.cancel();
      task.onQueuedCancel?.();
    }
    for (const task of this.active.values()) task.cancel();
  }

  get activeCount() {
    return this.active.size;
  }

  get queuedCount() {
    return this.queue.length;
  }

  private pump() {
    while (this.active.size < this.limit && this.queue.length) {
      const task = this.queue.shift();
      if (!task) return;
      this.active.set(task.id, task);
      void task
        .execute()
        .catch(() => undefined)
        .finally(() => {
          this.active.delete(task.id);
          this.pump();
        });
    }
  }
}
