module.exports = {
  apps: [
    {
      name: 'gestion',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      // Une boucle de crash au demarrage (token invalide, base illisible)
      // sature les logs en quelques secondes sans cette pause.
      restart_delay: 5000,
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
