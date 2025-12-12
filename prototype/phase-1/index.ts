import { DeterministicScheduler } from './scheduler';
import { agent1, agent2 } from './agents';
import { ONNXRuntimeService } from './onnx-runtime';

async function main() {
  console.log('Initializing the multi-agent runtime...');

  // Initialize the ONNX Runtime Service.
  const onnxService = await ONNXRuntimeService.create('./mnist.onnx');
  console.log('ONNX Runtime Service initialized.');

  // Initialize the scheduler with the ONNX service.
  const scheduler = new DeterministicScheduler(onnxService);
  scheduler.registerAgent(agent1.id);
  scheduler.registerAgent(agent2.id);

  console.log('Agents registered.');

  // Add tasks to the scheduler.
  scheduler.addTask(agent1.id, agent1.createTask());
  scheduler.addTask(agent2.id, agent2.createTask());
  scheduler.addTask(agent1.id, agent1.createTask());

  console.log('Tasks added to the queue.');

  // Run the scheduler for a few ticks to process all tasks.
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Scheduler Tick ${i + 1} ---`);
    await scheduler.runTick();
  }

  console.log('\nScheduler finished.');
}

main().catch(err => {
  console.error('An error occurred:', err);
  process.exit(1);
});
