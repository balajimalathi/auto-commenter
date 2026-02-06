# Twitter Commenter - Batch Mode

> Executed when "Fill today's quota" command given
> See SKILL.md for single reply workflow

---

## Batch Execution Trigger

Start batch mode with these commands:
- "Fill today's quota"
- "Consume all remaining quota"
- "Run in batch mode"

---

## Pre-Start Check

```
1. Check tracking/twitter/today's-date.md (create from template.md if missing)
2. Check current reply count by home timeline tab (`For you`, `Following`, `Build in Public`, `Fail in Public`, `Smol`)
3. Calculate remaining quota:
   - Total = sum of all tab daily limits
   - Subtract today's written replies
   - Remaining quota = Total - Today's written replies
```

---

## Batch Workflow

```
[Start]
    ↓
[1] Check tracking file (/tracking/twitter/(today's date).md) → Calculate remaining quota
    ↓
[2] Select home timeline tab under quota (by priority criteria)
    ↓
[3] Start reply writing loop for that tab
    ↓
    [3-1] Execute SKILL.md Step 1-8 (write single reply for the selected tab)
    ↓
    [3-2] Execute SKILL.md Step 9 (navigate back to home timeline to continue with next tweet)
    ↓
    [3-3] Update tracking file
    ↓
    [3-4] Report progress
    ↓
    [3-5] Check that tab's quota
          - Under limit → back to [3-1] (continue with next tweet from timeline)
          - Completed limit → to [4]
    ↓
[4] Move to next home timeline tab immediately
    ↓
[5] Check overall termination condition
    ↓
    YES → [End]
    NO  → Return to [2]
```

---

## Tab Selection Priority

| Priority | Criteria | Reason |
|----------|----------|--------|
| 1 | Tabs with 0 activity today | Ensure variety across tabs |
| 2 | Tabs with oldest last activity time | Distributed activity |
| 3 | Tabs with available quota | Efficiency |


---

## Wait Time Rules

| Situation | Wait Time |
|-----------|-----------|
| Between replies to same tab | 5mins |
| Between tab transitions | None |

### Execution Example

```
Start Tab: For you
  → Reply 1/25 written
  → Reply 2/25 written
  → Reply 3/25 written ✓

For you in progress → Move to Tab: Following (to mix tabs)

Start Tab: Following
  → Reply 1/25 written
  → Reply 2/25 written
  → Reply 3/25 written ✓

Following complete (quota reached) → Move to Tab: Build in Public
```

---

## Termination Conditions

Batch execution terminates when one of the following is met:

1. **Quota complete**: All tab quotas complete
2. **User interruption**: User requests stop
3. **Error occurred**: After 3 consecutive failures

---

### Progress Report
```
---
[Overall Progress] 6/125 completed

Completed tabs:
✓ For you: 3/25
✓ Following: 3/25
---
```

## Skip Conditions

When skipping specific tab:

**Only skip if**: All visible tweets have already been replied to today (check tracking file for duplicates)

**Never skip for**: Topic relevance, engagement level, or content type - reply to every tweet you see on each tab

---

## Error Handling

| Error | Response |
|-------|----------|
| Page loading failure | Wait 30s then retry (max 3 times) |
| Reply posting failure | Move to next tweet |
| Login session expired | Stop batch, notify user |
| Rate limit detected | Wait 30 min then resume |

---

## Batch Completion Report

```
---
## Batch Completion Report

**Total Written**: 12/18
**Time Spent**: 1 hour 45 minutes

### Results by Tab
| Tab | Written | Skip Reason |
|-----|---------|-------------|
| For you | 3/25 | - |
| Following | 3/25 | - |
| Build in Public | 2/25 | All tweets already replied to |
| Fail in Public | 2/25 | All tweets already replied to |
| Smol | 2/25 | All tweets already replied to |

### Potential Customers Discovered
- 1 (updated in leads/twitter.md)

### Special Notes
- Build in Public: Many posts today were not relevant to your engagement goals
---
```

> Single reply workflow (Step 1-8): See SKILL.md
> Personalization review: See resources/personalization_twitter.md
