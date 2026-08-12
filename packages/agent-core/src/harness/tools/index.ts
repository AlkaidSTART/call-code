import { getEnvironmentTool } from '@agent-core/harness/tools/getEnvironment';
import { bashTool } from '@agent-core/harness/tools/bash';
import { ocrImageTool } from '@agent-core/harness/tools/ocr';
import { gitDiffTool } from '@agent-core/harness/tools/gitDiff';
import { readFileTool } from '@agent-core/harness/tools/readFile';
import { searchTool } from '@agent-core/harness/tools/search';
import { writeFileTool } from '@agent-core/harness/tools/writeFile';
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
