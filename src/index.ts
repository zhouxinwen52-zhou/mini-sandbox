import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { createMiniSandboxServer } from './server.js';

serveStdio(() => createMiniSandboxServer());
