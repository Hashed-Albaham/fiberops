import { createFiberOpsApp } from "./app";

let appPromise: ReturnType<typeof createFiberOpsApp> | undefined;

export default async function handler(req: any, res: any) {
  appPromise ??= createFiberOpsApp();
  const app = await appPromise;
  return app(req, res);
}
