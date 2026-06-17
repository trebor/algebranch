import { compressString, decompressString } from '../src/index';

describe('compression utilities', () => {
  test('compress and decompress round-trips correctly', async () => {
    const original = 'Hello, world! This is a test string to compress.';
    const compressed = await compressString(original);
    const decompressed = await decompressString(compressed);
    expect(decompressed).toBe(original);
  });

  test('compressed string is URL-safe', async () => {
    const original = 'JSON payload: {"tree":{"0":{"id":"0","equation":{"lhs":{"type":"OperatorNode","op":"*","fn":"multiply","args":[{"type":"ConstantNode","value":2},{"type":"ParenthesisNode","content":{"type":"OperatorNode","op":"+","fn":"add","args":[{"type":"SymbolNode","name":"x"},{"type":"ConstantNode","value":3}]}}]},"rhs":{"type":"ConstantNode","value":10},"relation":"="},"parentId":null,"childrenIds":[],"label":"Initial","timestamp":1718500000000}},"currentNodeId":"0"}';
    const compressed = await compressString(original);
    
    // Check that it only contains Base64URL characters (a-zA-Z0-9-_) and no padding (=, +, /)
    expect(compressed).toMatch(/^[a-zA-Z0-9-_]+$/);
    
    const decompressed = await decompressString(compressed);
    expect(decompressed).toBe(original);
  });
});
