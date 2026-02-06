# Playwriter Script Snippets for X/Twitter

Exact working patterns for `playwriter_execute` when automating X/Twitter.

**Important:** These selectors are tested against X.com as of early 2026. Update them here if X's DOM changes.

## Navigation
```javascript
// Navigate to the home timeline
await page.goto('https://x.com/home');

// Navigate to a hashtag search (latest)
await page.goto('https://x.com/search?q=%23nocode&src=typed_query&f=live');

// Navigate to a user's profile/timeline
await page.goto('https://x.com/OpenAI');

// Navigate to a specific tweet
await page.goto('https://x.com/username/status/1234567890');
```

## Home Timeline Tabs (For you / Following / Build in Public / Fail in Public / Smol)

```javascript
// Assumes you are already on https://x.com/home

// Click the "For you" tab
await page.getByRole('tab', { name: 'For you' }).click();
await new Promise(r => setTimeout(r, 2000));

// Click the "Following" tab
await page.getByRole('tab', { name: 'Following' }).click();
await new Promise(r => setTimeout(r, 2000));

// Click the "Build in Public" tab
await page.getByRole('tab', { name: 'Build in Public' }).click();
await new Promise(r => setTimeout(r, 2000));

// Click the "Fail in Public" tab
await page.getByRole('tab', { name: 'Fail in Public' }).click();
await new Promise(r => setTimeout(r, 2000));

// Click the "Smol" tab
await page.getByRole('tab', { name: 'Smol' }).click();
await new Promise(r => setTimeout(r, 2000));
```

### Optional: Show Recent Tweets for Following

```javascript
// From the "Following" tab, open the tab menu and select "Recent"
await page.getByRole('tab', { name: 'Following' }).locator('svg').click();
await new Promise(r => setTimeout(r, 1000));
await page.getByRole('menuitem', { name: 'Recent' }).click();
await new Promise(r => setTimeout(r, 2000));
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

## Extract Tweets
```javascript
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
  return JSON.stringify(result.slice(0, 10));
});
return tweets;
```

## X/Twitter Reply Submission (timeline reply flow – recommended)

Execute these steps in sequence. **Always wait a bit after each click** so the UI can respond.

```javascript
// 1) Click the reply button on the chosen tweet in the timeline
// Example using an accessible name like "282 Replies. Reply"
await page.getByRole('button', { name: /Replies\. Reply$/ }).first().click();
await new Promise(r => setTimeout(r, 2000));

// 2) Focus the reply textbox ("Post text")
await page.getByRole('textbox', { name: 'Post text' }).click();
await new Promise(r => setTimeout(r, 1000));

// 3) Fill the reply text (replace with actual reply content)
await page.getByRole('textbox', { name: 'Post text' }).fill('Yes');

// 4) Click the tweet/reply button
await page.getByTestId('tweetButton').click();
await new Promise(r => setTimeout(r, 2000));
```

### Alternative reply flow (generic selectors)

```javascript
// 1) Click the first generic reply button
await page.locator('[data-testid="reply"]').first().click();
await new Promise(r => setTimeout(r, 2000));

// 2) Wait for the reply composer to appear
await page.waitForSelector('[data-testid="tweetTextarea_0"]');

// 3) Click the reply text area to focus it
await page.locator('[data-testid="tweetTextarea_0"]').click();
await new Promise(r => setTimeout(r, 1000));

// 4) Type the reply (with human-like delay)
await page.keyboard.type('Your reply text here', { delay: 25 });

// 5) Click the inline reply/post button
await page.locator('[data-testid="tweetButtonInline"]').click();
await new Promise(r => setTimeout(r, 2000));
```

## Check if Logged In
```javascript
const loggedIn = await page.evaluate(() => {
  return !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
});
return JSON.stringify({ loggedIn });
```
