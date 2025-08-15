import { cosineSimilarity } from '../src/utils/cosineSimilarity.js';

describe('cosineSimilarity', () => {
  test('should return 1 for identical vectors', () => {
    const vecA = [1, 1, 1];
    const vecB = [1, 1, 1];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1);
  });

  test('should return 0 for orthogonal vectors', () => {
    const vecA = [1, 0];
    const vecB = [0, 1];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('should return -1 for opposite vectors', () => {
    const vecA = [1, 1];
    const vecB = [-1, -1];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1);
  });

  test('should return 0 for empty vectors', () => {
    const vecA = [];
    const vecB = [];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('should return 0 for vectors of different lengths', () => {
    const vecA = [1, 2];
    const vecB = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });
});
