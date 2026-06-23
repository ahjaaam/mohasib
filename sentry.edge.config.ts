import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  enableLogs: true,
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (name.includes("/api/health") || name.includes("/monitoring")) return 0;
    return inheritOrSampleWith(process.env.NODE_ENV === "development" ? 1 : 0.1);
  },
  beforeSend(event) {
    if (event.request) {
      if (event.request.url) event.request.url = event.request.url.split("?")[0];
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.headers;
      delete event.request.query_string;
    }
    event.user = event.user?.id ? { id: event.user.id } : undefined;
    return event;
  },
});
