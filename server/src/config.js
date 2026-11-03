import process from "node:process";

// Зчитуємо та валідуємо налаштування з оточення
export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  logDir: process.env.LOG_DIR || "./logs"
};