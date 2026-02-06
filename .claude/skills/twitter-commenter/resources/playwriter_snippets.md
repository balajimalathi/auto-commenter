# Playwriter Script Snippets for X/Twitter

Exact working patterns for `playwriter_execute` when automating X/Twitter.

**Important:** These selectors are tested against X.com as of early 2026. Update them here if X's DOM changes.

## Navigation
```javascript
// Navigate to the home timeline
await page.goto('https://x.com/home');
await new Promise(r => setTimeout(r, 3000));

// Navigate to a specific tweet
await page.goto('https://x.com/username/status/1234567890');
await new Promise(r => setTimeout(r, 3000));

// Navigate back to home timeline after posting a reply (for batch mode)
// Use this after posting a reply on a /status/ page to continue with next tweet
await page.goto('https://x.com/home');
await new Promise(r => setTimeout(r, 3000));
// Note: The previously selected tab and "Recency" filter should still be active
// If not, re-click the tab and re-apply the "Recency" filter before extracting next tweets
```

## Home Timeline Tabs (For you / Following / Build in Public / Fail in Public / Smol)

**CRITICAL:** Always filter to "Recency" after clicking any tab to ensure you get the most recent tweets.

### Standard Pattern: Click Tab + Filter to Recency

```javascript
// Assumes you are already on https://x.com/home
// This pattern applies to ALL tabs - always filter to "Recency" after clicking

// 1) Click the tab
await page.getByRole('tab', { name: 'Tab Name Here' }).click();
await new Promise(r => setTimeout(r, 3000));

// 2) Open the tab's filter menu by clicking the SVG icon
await page.getByRole('tab', { name: 'Tab Name Here' }).locator('svg').click();
await new Promise(r => setTimeout(r, 3000));

// 3) Select "Recency" from the menu
await page.getByRole('menuitem', { name: 'Recency' }).click();
await new Promise(r => setTimeout(r, 3000));
```

### Complete Examples for Each Tab

```javascript
// For you tab
await page.getByRole('tab', { name: 'For you' }).click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('tab', { name: 'For you' }).locator('svg').click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('menuitem', { name: 'Recency' }).click();
await new Promise(r => setTimeout(r, 3000));

// Following tab
await page.getByRole('tab', { name: 'Following' }).click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('tab', { name: 'Following' }).locator('svg').click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('menuitem', { name: 'Recency' }).click();
await new Promise(r => setTimeout(r, 3000));

// Build in Public tab
await page.getByRole('tab', { name: 'Build in Public' }).click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('tab', { name: 'Build in Public' }).locator('svg').click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('menuitem', { name: 'Recency' }).click();
await new Promise(r => setTimeout(r, 3000));

// Fail in Public tab
await page.getByRole('tab', { name: 'Fail in Public' }).click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('tab', { name: 'Fail in Public' }).locator('svg').click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('menuitem', { name: 'Recency' }).click();
await new Promise(r => setTimeout(r, 3000));

// Smol tab
await page.getByRole('tab', { name: 'Smol' }).click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('tab', { name: 'Smol' }).locator('svg').click();
await new Promise(r => setTimeout(r, 3000));
await page.getByRole('menuitem', { name: 'Recency' }).click();
await new Promise(r => setTimeout(r, 3000));
```

## Get Page Text
```javascript
return await page.evaluate(() => document.body.innerText);
```

## Scroll
```javascript
await page.evaluate((px) => window.scrollBy(0, px), 500);
```

## Get Current URL
```javascript
return page.url();
```

## Extract Tweets (Top 10)

**CRITICAL:** Always extract only the top 10 tweets after filtering to "Recency". This ensures you're responding to the most recent content.

```javascript
// Extract the top 10 tweets from the current timeline
// Use this AFTER clicking a tab and filtering to "Recent"
const tweets = await page.evaluate(() => {
  const result = [];
  document.querySelectorAll('article[data-testid="tweet"]').forEach((tweet) => {
    const textEl = tweet.querySelector('[data-testid="tweetText"]');
    const authorEl = tweet.querySelector('[data-testid="User-Name"] a');
    const timeEl = tweet.querySelector('time');
    const linkEl = tweet.querySelector('a[href*="/status/"]');
    if (textEl && linkEl) {
      result.push({
        text: textEl.textContent?.trim() || '',
        author: authorEl?.textContent?.trim() || '',
        time: timeEl?.getAttribute('datetime') || '',
        url: 'https://x.com' + linkEl.getAttribute('href'),
      });
    }
  });
  // Always limit to top 10 tweets
  return JSON.stringify(result.slice(0, 10));
});
return tweets;
```

## X/Twitter Reply Submission (status page flow – recommended)

**CRITICAL:** Do NOT click the reply button (it opens a popup). Instead, navigate to the status page and click the textarea directly.

Execute these steps in sequence. **Always wait a bit after each click** so the UI can respond.

### Method 1: Click post to navigate to status page, then click textarea directly

```javascript
// 1) Click on the tweet text to navigate to the /status page
// This opens the tweet's detail page instead of a popup
await page.getByRole('article').getByTestId('tweetText').first().click();
await new Promise(r => setTimeout(r, 3000));

// 2) Wait for navigation to status page (URL should contain /status/)
await page.waitForURL(/\/status\//);
await new Promise(r => setTimeout(r, 3000));

// 3) Click directly on the textarea (NOT the reply button - that opens popup)
await page.getByTestId('tweetTextarea_0').locator('div').nth(3).click();
await new Promise(r => setTimeout(r, 3000));

// 4) Type the reply (with human-like delay)
await page.keyboard.type('Your reply text here', { delay: 25 });
await new Promise(r => setTimeout(r, 500));

// 5) Click the reply/post button (use tweetButtonInline for status page)
await page.getByTestId('tweetButtonInline').click();
await new Promise(r => setTimeout(r, 3000));
```

### Method 2: Navigate directly to status URL, then click textarea

```javascript
// 1) Navigate directly to the tweet's status page
// URL format: https://x.com/username/status/1234567890
await page.goto('https://x.com/username/status/1234567890');
await new Promise(r => setTimeout(r, 3000));

// 2) Click directly on the textarea (NOT the reply button)
await page.getByTestId('tweetTextarea_0').locator('div').nth(3).click();
await new Promise(r => setTimeout(r, 3000));

// 3) Type the reply (with human-like delay)
await page.keyboard.type('Your reply text here', { delay: 25 });
await new Promise(r => setTimeout(r, 500));

// 4) Click the reply/post button (use tweetButtonInline for status page)
await page.getByTestId('tweetButtonInline').click();
await new Promise(r => setTimeout(r, 3000));
```

### ⚠️ Important Notes

- **Never click the reply button** - it opens a popup modal that breaks the flow
- **Always navigate to /status page first** - either by clicking the tweet or going directly to the URL
- **Click the textarea directly** - use `getByTestId('tweetTextarea_0').locator('div').nth(3).click()`
- **Use correct button selector** - On status page, use `tweetButtonInline` (NOT `tweetButton`)
- **Wait between actions** - Twitter's UI needs time to respond to each interaction

## Check if Logged In
```javascript
const loggedIn = await page.evaluate(() => {
  return !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
});
return JSON.stringify({ loggedIn });
```
