// Mock agent 1
export const agent1 = {
  id: 'agent-1',
  createTask: () => ({
    description: 'Agent 1 task',
    // a 28x28 image of a '2'
    input: new Float32Array(784).fill(0).map((_, i) => (
      (i > 200 && i < 220) || (i > 300 && i < 320) || (i > 400 && i < 420)
    ) ? 1 : 0),
  }),
};

// Mock agent 2
export const agent2 = {
  id: 'agent-2',
  createTask: () => ({
    description: 'Agent 2 task',
    // a 28x28 image of a '7'
    input: new Float32Array(784).fill(0).map((_, i) => (
      (i > 100 && i < 120) || (i > 200 && i < 220) || (i > 300 && i < 320)
    ) ? 1 : 0),
  }),
};
