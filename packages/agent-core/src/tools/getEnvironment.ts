import { access } from 'node:fs/promises';
import process from 'node:process';
import { getKnownLocations } from '@tools/pathUtils';

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const getEnvironmentTool = {
  name: 'get_environment',
  description:
    'Inspect the local runtime environment, including current directory and common user folders.',
  parameters: {
    type: 'object',
    properties: {},
  },
  run: async () => {
    const locations = getKnownLocations();

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      shell: process.env.SHELL || process.env.ComSpec || null,
      now: new Date().toISOString(),
      locations: {
        cwd: {
          path: locations.cwd,
          exists: await exists(locations.cwd),
        },
        home: {
          path: locations.home,
          exists: await exists(locations.home),
        },
        desktop: {
          path: locations.desktop,
          exists: await exists(locations.desktop),
        },
        documents: {
          path: locations.documents,
          exists: await exists(locations.documents),
        },
        downloads: {
          path: locations.downloads,
          exists: await exists(locations.downloads),
        },
        temp: {
          path: locations.temp,
          exists: await exists(locations.temp),
        },
      },
      pathAliases: [
        '~',
        'home:/...',
        'desktop:/...',
        'Desktop/...',
        '桌面/...',
        'documents:/...',
        'downloads:/...',
        'temp:/...',
      ],
    };
  },
};
