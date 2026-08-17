import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

/**
 * Configures the API shared by the long-lived Node server and the Vercel
 * serverless function. Vite is attached only by the Node entrypoint so that a
 * production Vercel function never imports Vite or Rollup at runtime.
 */
export async function createFiberOpsApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  return app;
}
