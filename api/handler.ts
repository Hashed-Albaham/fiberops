import { createFiberOpsApp } from "../server/app";

let appPromise: ReturnType<typeof createFiberOpsApp> | undefined;

/** Source handler bundled into api/index.js specifically for the Vercel runtime. */
export default async function handler(req: any, res: any) {
  appPromise ??= createFiberOpsApp();
  const app = await appPromise;
  return app(req, res);
}
