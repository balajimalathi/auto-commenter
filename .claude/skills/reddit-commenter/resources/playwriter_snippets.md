# Playwriter Script Snippets

Exact working patterns for `playwriter_execute` when automating Reddit.

**Important:** These selectors are tested and working. Update them here if Reddit's DOM changes.

## Navigation
```javascript
await page.goto('https://www.reddit.com/r/{subreddit}/new/');
// Or navigate to a specific post:
await page.goto('https://www.reddit.com/r/{subreddit}/comments/{post_id}/{slug}/');
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

## Extract Reddit Posts
```javascript
const posts = await page.evaluate(() => {
  const result = [];
  document.querySelectorAll('article, [data-testid="post-container"], shreddit-post').forEach((post) => {
    const titleEl = post.querySelector('h3, [slot="title"], a[data-click-id="body"]');
    const linkEl = post.querySelector('a[href*="/comments/"]');
    const authorEl = post.querySelector('a[href*="/user/"]');
    if (titleEl && linkEl) {
      result.push({ title: titleEl.textContent?.trim() || '', url: linkEl.href, author: authorEl?.textContent?.replace('u/', '').trim() || '', subreddit: window.location.pathname.split('/')[2] || '' });
    }
  });
  return JSON.stringify(result.slice(0, 10));
});
return posts;
```

## Reddit Comment Submission (exact working steps)

Execute these steps in sequence. **Always wait 2 seconds after each click** so the UI can respond before the next action.

### Step 1: Click the comment composer trigger
```javascript
await page.click('comment-composer-host');
await new Promise(r => setTimeout(r, 2000));
```

### Step 2: Wait for the text editor to appear
```javascript
await page.waitForSelector('[contenteditable="true"][role="textbox"]');
```

### Step 3: Click the text editor to focus it
```javascript
await page.click('[contenteditable="true"][role="textbox"]');
await new Promise(r => setTimeout(r, 2000));
```

### Step 4: Type the comment (with human-like delay)
```javascript
await page.keyboard.type('Your comment text here', { delay: 20 });
```

### Step 5: Click the submit button
```javascript
await page.locator('button[slot="submit-button"]').click();
await new Promise(r => setTimeout(r, 2000));
```
