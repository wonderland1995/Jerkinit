import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,     // ✅ ensure this is true
  },
};

module.exports = nextConfig;
