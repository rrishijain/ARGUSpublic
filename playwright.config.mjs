import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:true,workers:2,timeout:30000,
  use:{baseURL:'http://127.0.0.1:3117',headless:true,trace:'off',channel:process.env.ARGUS_BROWSER_CHANNEL||undefined},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:3117',reuseExistingServer:!process.env.CI,timeout:120000},
  reporter:'list',
});
