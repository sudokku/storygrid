import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..');

const REQUIRED_FOLDERS = ['Editor', 'Grid', 'UI', 'store', 'lib', 'types'];

describe('Folder structure (SCAF-04)', () => {
  REQUIRED_FOLDERS.forEach((folder) => {
    it(`src/${folder}/index.ts exists`, () => {
      expect(existsSync(resolve(SRC, folder, 'index.ts'))).toBe(true);
    });
  });
});
