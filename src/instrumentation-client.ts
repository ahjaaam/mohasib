import * as Sentry from "@sentry/nextjs";

function stripQuery(value?: string) {
  if (!value) return value;
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin === window.location.origin ? "" : url.origin}${url.pathname}`;
  } catch {
    return value.split("?")[0];
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  enableLogs: true,
  integrations: [
    Sentry.browserTracingIntegration({
      shouldCreateSpanForRequest: (url) => !url.includes("/api/health"),
    }),
  ],
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (name.includes("/api/health") || name.includes("/monitoring")) return 0;
    return inheritOrSampleWith(process.env.NODE_ENV === "development" ? 1 : 0.1);
  },
  tracePropagationTargets: ["localhost", /^\//, /^https:\/\/([a-z0-9-]+\.)?mohasibai\.com/],
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
      breadcrumb.data.url = stripQuery(breadcrumb.data.url);
    }
    return breadcrumb;
  },
  beforeSend(event) {
    if (event.request) {
      event.request.url = stripQuery(event.request.url);
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.headers;
      delete event.request.query_string;
    }
    event.user = event.user?.id ? { id: event.user.id } : undefined;
    return event;
  },
  beforeSendTransaction(event) {
    if (event.transaction?.includes("/api/health") || event.transaction?.includes("/monitoring")) return null;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
