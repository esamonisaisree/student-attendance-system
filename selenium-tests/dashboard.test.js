
const { Builder, By, until } = require("selenium-webdriver");

async function testDashboard() {
  let driver;

  try {
    driver = await new Builder()
      .forBrowser("chrome")
      .build();

    console.log("Opening Student Attendance Dashboard...");

    await driver.get("http://localhost:30081");

    await driver.wait(
      until.elementLocated(By.css("body")),
      10000
    );

    const title = await driver.getTitle();
    const bodyText = await driver.findElement(By.css("body")).getText();

    console.log("Page title:", title);

    if (!bodyText.trim()) {
      throw new Error("Dashboard page is empty.");
    }

    console.log("PASS: Dashboard loaded successfully.");
  } catch (error) {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

testDashboard();
