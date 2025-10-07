import { expect, test } from "@playwright/test";

test.describe("Rich text editor", () => {
  test("persists content across reloads", async ({ page }) => {
    console.log("Running persistence test");
    await page.goto("/");
    console.log("Navigated to home page");

    const newPageButton = page
      .getByRole("button", { name: "New Page" })
      .first();

    console.log("Waiting for New Page button to be visible");
    await newPageButton.waitFor({ state: "visible" });

    await newPageButton.click();
    console.log("Clicked New Page button");
    await page.waitForURL(/\/page\/[\w-]+(?:[\/?#].*)?$/);
    console.log("New page created and navigated to its URL");
    const pageIdMatch = page.url().match(/\/page\/([^/?#]+)/);
    const pageId = pageIdMatch?.[1];
    expect(pageId, "captures the new page id from the URL").toBeTruthy();

    const editor = page.locator(".ProseMirror");
    await editor.waitFor();
    await editor.click();

    const content = `Persistence smoke test ${Date.now()}`;
    await page.keyboard.type(content);
    await expect(editor).toContainText(content);

    const saveShortcut = process.platform === "darwin" ? "Meta+S" : "Control+S";
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/pages/${pageId}`) &&
        response.request().method() === "PUT" &&
        response.status() === 200
    );

    await page.keyboard.press(saveShortcut);
    await saveResponsePromise;

    await page.reload();
    await expect(editor).toContainText(content);

    await page.goto("/");
    if (pageId) {
      const deleteResponse = await page.request.delete(
        `http://localhost:3001/pages/${pageId}`
      );
      expect(deleteResponse.ok(), "cleanup delete request to succeed").toBe(
        true
      );
    }
  });
});
