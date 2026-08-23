import { getEnvironmentTool } from './getEnvironment';
import { bashTool } from './bash';
import { ocrImageTool } from './ocr';
import { gitDiffTool } from './gitDiff';
import { readFileTool } from './readFile';
import { searchTool } from './search';
import { writeFileTool } from './writeFile';
export {
  bashTool,
  getEnvironmentTool,
  gitDiffTool,
  ocrImageTool,
  readFileTool,
  searchTool,
  writeFileTool,
};
export const tools = [
  getEnvironmentTool,
  readFileTool,
  writeFileTool,
  searchTool,
  bashTool,
  gitDiffTool,
  ocrImageTool,
];
