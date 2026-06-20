import type { Instrumentation } from "next";
import { reportError } from "@/lib/observability";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (error) => {
      reportError("process.unhandled_rejection", error);
    });
    process.on("uncaughtException", (error) => {
      reportError("process.uncaught_exception", error);
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  reportError("request.unhandled_error", error, {
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
