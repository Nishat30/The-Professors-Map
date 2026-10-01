# Floor 7 survey (Cloudflare Worker + D1)

Live: https://floor7-survey.personal-d22.workers.dev/survey

Walk the floor, stand at each landmark, record ~20 s of GPS. Each recording goes straight to the
`floor7-survey-db` D1 database (it queues on the phone if the internet drops, and retries).
Record important spots 2–3 times and ★ the one you trust. The final spot is the median of the ★
recordings, or of all recordings if none are starred.

```bash
npx wrangler deploy                                       # redeploy after edits
npx wrangler d1 execute floor7-survey-db --remote --command "SELECT label, floor, lat, lng, acc, is_real FROM points WHERE deleted = 0"
curl -s https://floor7-survey.personal-d22.workers.dev/api/export > survey.json   # everything, with raw samples
```

No login: anyone with the link can add points. "Remove" only hides a row (`deleted = 1`), so nothing is lost.
