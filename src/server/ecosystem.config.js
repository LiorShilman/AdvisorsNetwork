module.exports = {
  apps: [
    {
      name: 'advisor-network-api',
      script: './server.js',
      cwd: 'e:/AllMyProjects/advisor-network/src/server',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 21500
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 9292
      },
      // Restart policy
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,

      // Logging
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Advanced features
      listen_timeout: 5000,
      kill_timeout: 5000,
      wait_ready: false
    }
  ]
};
