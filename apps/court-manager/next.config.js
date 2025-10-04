/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许从任何IP访问
  experimental: {
    // 这个配置在较新版本的Next.js中可能不需要
  },
  // 在开发模式下绑定到所有网络接口
  ...(process.env.NODE_ENV === 'development' && {
    webpack: (config, { dev }) => {
      if (dev) {
        // 开发模式配置
      }
      return config
    }
  })
}

module.exports = nextConfig