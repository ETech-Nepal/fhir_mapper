import { buildApp } from './app.js';

const processLike = (globalThis as { process?: { argv?: string[]; env?: Record<string, string | undefined>; exit?: (code: number) => never } }).process;
const app = buildApp();

app.listen({ port: Number(processLike?.env?.PORT) || 3000, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  processLike?.exit?.(1);
});
