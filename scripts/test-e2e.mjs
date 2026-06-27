import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || (process.cwd().includes('/gemini/') ? 'http://localhost:3001' : 'http://localhost:3000');
const url = `${BASE_URL}/?eq=2%2A%28x%2B3%29%3D10`;

async function run() {
  console.log(`[E2E Test] Target URL: ${url}`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    
    // Suppress onboarding
    await page.addInitScript(() => {
      localStorage.setItem('algebranch_onboarding_completed', 'true');
    });

    console.log('Navigating...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    
    console.log('Waiting for equation tree to mount...');
    await page.waitForSelector('[data-eq-node]', { timeout: 10000 });

    const getLatestEquation = async () => {
      return await page.evaluate(() => {
        const lastStep = document.querySelector('[aria-label^="Step"]:last-child');
        return lastStep ? lastStep.getAttribute('aria-label') : 'Unknown';
      });
    };

    console.log(`Initial State: ${await getLatestEquation()}`);

    // --- Step 1: Transpose 2 ---
    console.log('\n--- Step 1: Transposing the multiplier 2 ---');
    const twoNode = page.locator('[role="treeitem"]').filter({ hasText: /^2$/ }).first();
    await twoNode.click();
    console.log('Clicked "2" to select it');
    await page.waitForTimeout(500);

    const tenNode = page.locator('[role="treeitem"]').filter({ hasText: /^10$/ }).first();
    await tenNode.click();
    console.log('Clicked target "10" to transpose');
    await page.waitForTimeout(1000);

    const step1 = await getLatestEquation();
    console.log(`Equation after step 1: ${step1}`);
    if (!step1.includes('x plus 3 equals 10 over 2') && !step1.includes('x + 3 = 10 / 2')) {
      throw new Error(`Transposition failed! Current state: ${step1}`);
    }

    // --- Step 2: Simplify 10 / 2 ---
    console.log('\n--- Step 2: Simplifying 10 / 2 ---');
    const simplifyButton1 = page.locator('role=button[name="Simplify"]').first();
    await simplifyButton1.click();
    console.log('Clicked "Simplify" handle');
    await page.waitForTimeout(1000);

    const step2 = await getLatestEquation();
    console.log(`Equation after step 2: ${step2}`);
    if (!step2.includes('x plus 3 equals 5') && !step2.includes('x + 3 = 5')) {
      throw new Error(`Simplification failed! Current state: ${step2}`);
    }

    // --- Step 3: Transpose 3 ---
    console.log('\n--- Step 3: Transposing the constant 3 ---');
    const threeNode = page.locator('[role="treeitem"]').filter({ hasText: /^3$/ }).first();
    await threeNode.click();
    console.log('Clicked "3" to select it');
    await page.waitForTimeout(500);

    const fiveNode = page.locator('[role="treeitem"]').filter({ hasText: /^5$/ }).first();
    await fiveNode.click();
    console.log('Clicked target "5" to transpose');
    await page.waitForTimeout(1000);

    const step3 = await getLatestEquation();
    console.log(`Equation after step 3: ${step3}`);
    if (!step3.includes('x equals 5 minus 3') && !step3.includes('x = 5 - 3')) {
      throw new Error(`Transposition of 3 failed! Current state: ${step3}`);
    }

    // --- Step 4: Simplify 5 - 3 ---
    console.log('\n--- Step 4: Simplifying 5 - 3 ---');
    const simplifyButton2 = page.locator('role=button[name="Simplify"]').first();
    await simplifyButton2.click();
    console.log('Clicked "Simplify" handle');
    await page.waitForTimeout(1000);

    const step4 = await getLatestEquation();
    console.log(`Equation after step 4: ${step4}`);
    if (!step4.includes('x equals 2') && !step4.includes('x = 2')) {
      throw new Error(`Final simplification failed! Current state: ${step4}`);
    }

    console.log('\n======================================================');
    console.log('🎉 SUCCESS: Headless E2E Test Completed Successfully!');
    console.log('The equation was solved to x = 2.');
    console.log('======================================================\n');

  } catch (err) {
    console.error('\n❌ E2E Test Failed:', err.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
