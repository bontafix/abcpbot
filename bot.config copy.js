module.exports = {
  apps: [
    {
      name: 'abcp-prod',
      script: './dist/server.js',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 8803,
        WEBHOOK_PATH: '/abcp-prod',
        BOT_TOKEN: '11111',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // error_file: './logs/prod-error.log',
      // out_file: './logs/prod-out.log',
      // log_file: './logs/prod-combined.log'
    },
    {
      name: 'abcp-dev',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      env: {
        NODE_ENV: 'development',
        PORT: 8804,
        WEBHOOK_PATH: '/abcp-dev',
        BOT_TOKEN: '22222',
      },
      instances: 1,
      autorestart: true,
      watch: true,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', 'dist', '.git'],
      max_memory_restart: '1G',
      // error_file: './logs/dev-error.log',
      // out_file: './logs/dev-out.log',
      // log_file: './logs/dev-combined.log'
    }
  ]
};
