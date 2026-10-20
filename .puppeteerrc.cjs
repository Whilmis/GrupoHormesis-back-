const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Guarda el binario de Chrome dentro del proyecto para que persista en el contenedor de Railway
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
