# Bug Report — SE_Group10_FYP (Round 2)

**Date:** 2026-04-25
**Last updated:** 2026-04-26
**Status: All confirmed bugs fixed.**

---

## Confirmed false positives (not bugs)

- `groupErrorsByQuestion` "always-true currentMostRecent" — works correctly.
- FSRS new-card `setMeta` — already saves stability.
- SM2 projection mismatch — both branches produce `+1d` for first review; they match.
- `q5 = [1,3,4,5][min(quality, 3)]` — clamp is intentional.
- `algorithm = … or schedule["algorithm"] or "sm2"` — `or` chain handles None.
- `/error-book/schedule-review` route — payload-based, ownership-validated.
- `prev?.concept` optional chain — already null-safe.
- `db_explorer.py` SQL "injection" — table names are hardcoded literals, no injection vector.
- AI category regex — already validated against the category list.
- `choices?.[selectedChoice]` in `usePracticeExamQuestions` — already guarded with optional chaining.
- `Math.round` in `useScheduleErrorReview` — compares midnight-aligned ISO strings, always whole-day diffs.
- `PalaceImmersiveView` `Task {}` retain cycles — view is a struct, no reference cycles possible.
- `ImageCache` calling `@MainActor KeychainService` — valid Swift concurrency, synchronous hop.
- `palaceRoot` access at lines 221/232 — uses unwrapped local `root`, not the optional directly.
- TLS verification on `requests.get()` — default `verify=True` is correct, no bug.
- `simple` algorithm always +2d for non-`again` — confirmed design choice.
