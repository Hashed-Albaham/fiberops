import { createFiberOpsApp } from "../server/app";

let appPromise: ReturnType<typeof createFiberOpsApp> | undefined;

/** Vercel Node Function entry point for tRPC and OAuth routes. */
export default async function handler(req: any, res: any) {
  appPromise ??= createFiberOpsApp();
  const app = await appPromise;
  return app(req, res);
}
