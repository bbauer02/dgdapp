/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-konva pulls in the optional `canvas` node module for SSR paths.
  // We render the planner client-only, so tell webpack to ignore it.
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
