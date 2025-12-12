import { ONNXRuntimeService } from './onnx-runtime';

export class DeterministicScheduler {
  private taskQueues: Map<string, any[]> = new Map();
  private agents: string[] = [];
  private onnxService: ONNXRuntimeService;

  constructor(onnxService: ONNXRuntimeService) {
    this.onnxService = onnxService;
  }

  // Register an agent with the scheduler.
  registerAgent(agentId: string) {
    if (!this.taskQueues.has(agentId)) {
      this.taskQueues.set(agentId, []);
      this.agents.push(agentId);
    }
  }

  // Add a task to an agent's queue.
  addTask(agentId: string, task: any) {
    if (this.taskQueues.has(agentId)) {
      this.taskQueues.get(agentId)!.push(task);
    }
  }

  // Run the scheduler for one tick.
  async runTick() {
    for (const agentId of this.agents) {
      const queue = this.taskQueues.get(agentId)!;
      if (queue.length > 0) {
        const task = queue.shift();
        console.log(`[Scheduler] Executing task for agent ${agentId}: ${task.description}`);

        // Execute the inference task.
        const output = await this.onnxService.run(task.input);
        console.log(`[Scheduler] Inference result for ${agentId}:`, output.data);
      }
    }
  }
}
