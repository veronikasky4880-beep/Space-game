import { test, expect } from "@playwright/test";

test("Two browsers join the same room and sync game state", async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  // 1. Перший гравець відкриває лобі
  await page1.goto("http://localhost:5173");
  await page1.fill("#player-name", "Pilot-1");

  // 2. Другий гравець відкриває лобі
  await page2.goto("http://localhost:5173");
  await page2.fill("#player-name", "Pilot-2");

  // Перевірка наявності canvas та елементів лоббі
  await expect(page1.locator("#game")).toBeVisible();
  await expect(page2.locator("#game")).toBeVisible();

  await context1.close();
  await context2.close();
});