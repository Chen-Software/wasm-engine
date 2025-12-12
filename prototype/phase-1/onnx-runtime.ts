import { InferenceSession, Tensor } from 'onnxruntime-node';

export class ONNXRuntimeService {
  private session: InferenceSession;

  private constructor(session: InferenceSession) {
    this.session = session;
  }

  public static async create(modelPath: string): Promise<ONNXRuntimeService> {
    const session = await InferenceSession.create(modelPath);
    return new ONNXRuntimeService(session);
  }

  public async run(input: Float32Array): Promise<any> {
    const inputTensor = new Tensor('float32', input, [1, 1, 28, 28]);
    const feeds = { 'Input3': inputTensor };
    const results = await this.session.run(feeds);
    return results.Plus214_Output_0;
  }
}
