import fs from 'fs/promises';
import path from 'path';

describe('index.js', () => {
  test('should not contain fs.writeFileSync', async () => {
    const filePath = path.resolve(process.cwd(), 'index.js');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).not.toContain('fs.writeFileSync');
  });

  test('should use fs.appendFile for logging', async () => {
    const filePath = path.resolve(process.cwd(), 'index.js');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toContain('fs.appendFile');
  });

  test('should handle processMessage asynchronously', async () => {
    const filePath = path.resolve(process.cwd(), 'index.js');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    // Check that processMessage is called without await and has a .catch block
    expect(fileContent).toMatch(/processMessage\(req\.body\)\.catch\(/);
  });
});
