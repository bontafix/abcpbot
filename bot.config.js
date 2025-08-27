module.exports = {
  apps: [
    {
      name: 'abcp-prod',
      script: './dist/server.js',
      cwd: './',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'abcp-dev',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};