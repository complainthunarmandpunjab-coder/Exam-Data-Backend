module.exports = {
  apps: [
    {
      name: 'exam-form-backend',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '1G',
      combine_logs: true,
      merge_logs: true,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log'
    }
  ]
};
