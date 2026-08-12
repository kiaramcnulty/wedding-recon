import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't infer it from a stray lockfile
  // elsewhere on the machine.
  turbopack: {
    root: __dirname,
  },

  // PostHog reverse proxy. The browser sends analytics to same-origin /ingest/*
  // (see instrumentation-client.ts, api_host: "/ingest") and Next forwards it to
  // PostHog. Keeping it first-party is what defeats host-based ad-blockers, which
  // run heavy in our launch channels (Reddit especially) and would otherwise
  // undercount those sources more than the others — biasing the exact comparison
  // the pilot exists to make. US region is hardcoded to match the project; note
  // static assets and ingestion have different upstreams per PostHog's docs.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog ingestion endpoints must not get a trailing slash appended.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
