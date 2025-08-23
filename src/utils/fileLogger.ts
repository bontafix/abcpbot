import { promises as fs } from 'fs';
import path from 'path';

export async function appendLogLine(filePath: string, line: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(filePath, line.endsWith('\n') ? line : line + '\n', 'utf8');
  } catch (err) {
    console.error('Ошибка записи лога:', err);
  }
}


