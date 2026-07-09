module.exports = {
  apps: [{
    name: 'evm-mcp',
    cwd: '/home/ubuntu/evm-mcp-server/servers/evm-mcp-server',
    script: 'node_modules/.pnpm/tsx@4.23.0/node_modules/tsx/dist/cli.mjs',
    args: 'src/index.ts',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      PATH: '/usr/local/bin:/usr/bin:/bin',
    },
    max_restarts: 5,
    restart_delay: 2000,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
  }]
};
