import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The dev server blocks cross-origin requests to dev-only assets, and treats
   * only the hostname it was started with as its own -- which is `localhost`.
   *
   * Everything in this project is pinned to 127.0.0.1 (the Supabase site_url,
   * the auth cookie name, the test suites), and browsers treat `localhost` and
   * `127.0.0.1` as different origins. Without this, every /_next asset comes
   * back 403 when the app is opened on 127.0.0.1 and the page renders unstyled
   * and unhydrated.
   *
   * Development only -- the option has no effect on a production build.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
