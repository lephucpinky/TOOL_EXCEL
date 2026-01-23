import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  images: {
    //domains: ['192.168.1.142:4003'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '192.168.1.61',
        port: '4009',
        pathname: '/images/**',
        search: '',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4009',
        pathname: '/images/**',
        search: '',
      },
    ],
  },
};
export default nextConfig;


