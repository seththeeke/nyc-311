import { expect, type Locator, type Page, test } from "@playwright/test";

/*
 * Mapv2 in a real browser (docs/14-maps-refactor.md §4.8): the unit suite
 * runs against a fake MapLibre and a mocked renderer, so this is the only
 * check that WebGL actually draws. Needs MAP_V2 on T1 or T2 in the target.
 */

/** A blank or single-colour canvas has a handful of colours; a drawn city or street has hundreds. */
const MIN_DISTINCT_COLOURS = 40;

/** Counts coarse colours across a grid of samples from the element's screenshot, decoded in the page itself. */
async function distinctColours(page: Page, target: Locator): Promise<number> {
  const png = (await target.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return 0;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const seen = new Set<number>();
    const step = Math.max(1, Math.floor(Math.min(image.width, image.height) / 120));
    for (let y = 0; y < image.height; y += step) {
      for (let x = 0; x < image.width; x += step) {
        const i = (y * image.width + x) * 4;
        seen.add(((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4));
      }
    }
    return seen.size;
  }, png);
}

test("the 3-D city loads and draws", async ({ page }) => {
  await page.goto("/mapv2");
  const city = page.getByTestId("mapv2-city");
  await expect(city).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "3-D map unavailable" })).toHaveCount(0);
  /* Let the establishing shot settle and the tiles arrive before sampling. */
  await page.waitForTimeout(6_000);
  expect(await distinctColours(page, city)).toBeGreaterThan(MIN_DISTINCT_COLOURS);
});

test("diving into a working crew's job draws the street scene", async ({ page }) => {
  await page.goto("/mapv2");
  await expect(page.getByTestId("mapv2-city")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  /* "Live" replaces the loading spinner once the first fleet poll lands. */
  await expect(page.getByRole("region", { name: "Fleet summary" }).getByText("Live", { exact: true })).toBeVisible({ timeout: 30_000 });
  const roster = page.getByRole("region", { name: "Fleet roster" });
  const working = roster.getByRole("button").filter({ hasText: "Working" }).first();
  test.skip((await working.count()) === 0, "No crew is working in this environment right now, so there's no job to dive into.");

  await working.click();
  await page.getByRole("button", { name: "Dive into job" }).click();
  await expect(page).toHaveURL(/\/mapv2\/job\//, { timeout: 30_000 });
  const scene = page.getByRole("img", { name: /Animated close-up of/ });
  await expect(scene).toBeVisible();
  await page.waitForTimeout(3_000);
  expect(await distinctColours(page, scene)).toBeGreaterThan(MIN_DISTINCT_COLOURS);
});
