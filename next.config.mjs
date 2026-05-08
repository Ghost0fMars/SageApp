/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.ELECTRON_BUILD === 'true' && { output: 'standalone' }),
};

export default nextConfig;
