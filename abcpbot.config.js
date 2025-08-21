module.exports = {
    apps: [
      {
        name: 'abcp-bot', // Название процесса
        script: './dist/server.js', // Путь к собранному файлу
        instances: 1, // Количество инстансов (по умолчанию 1)
        autorestart: true, // Перезапуск при сбоях
        watch: false, // Не следить за изменениями в коде (для продакшн-среды)
        max_memory_restart: '200M', // Перезапуск, если память превышает лимит
        env: {
          NODE_ENV: 'production', // Переменная окружения для продакшн
        //   BOT_TOKEN: 'your-telegram-bot-token', // Токен бота
        },
      },
    ],
  };