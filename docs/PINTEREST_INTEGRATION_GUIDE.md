# Pinterest API connection and test guide

Implementation reference: `docs/SPEC-pinterest-ingestion.md`.

This adapter uses only Pinterest's official REST API. It does not use
Pinterest page scraping, browser automation, proxy rotation, third-party Pin
actors, or the beta `search/partner/pins` endpoint.

## 1. What is implemented

- `probe_access.py`: standalone OAuth/Trends entitlement probe.
- `src/pinterest_ingestion/pinterest_client.py`: official Trends v5 client,
  repeated-key `include_keywords`, 60 calls/minute spacing, and retry only for
  HTTP 429/5xx.
- `config/seed_keywords.yaml` and `keyword_mapper.py`: deterministic seed
  mapping; unknown phrases remain `UNMAPPED` unless a high-confidence LLM
  mapper is explicitly injected.
- `demand_score.py`: explainable 0-100 score with missing-weight
  redistribution. Missing data stays `None`, never zero.
- `data/manual_pins_snapshot.csv`: human-entered Plan B for an app that gets
  HTTP 403 from Trends.
- `data/pinterest_cache/raw/`: generated raw cache, automatically purged after
  no more than six hours and ignored by Git.
- `data/pinterest_signals.json`: generated signal output, separate from the
  project's permanent Product Opportunity CSV schema.

The old provider that queried a web-search index for Pinterest pages and
returned hard-coded momentum/persona claims has been removed. The existing
LangChain tool name is retained, but it now reports official demand-interest
fields or an explicit unavailable status.

## 2. Pinterest prerequisites

You need all of the following before a live call:

1. A Pinterest Business account.
2. An app created in Pinterest Developers, with an App ID and App Secret.
3. A user-authorized OAuth access token with `user_accounts:read`.

The Trends endpoint uses the OAuth Authorization Code flow. Do not use a
client-credentials token for it. A successful `/v5/user_account` call proves
basic token access but does not prove the app is entitled to Trends; the Trends
probe in step 5 is the actual gate.

Official references:

- [Authentication and authorization](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)
- [Pinterest Trends API](https://developers.pinterest.com/docs/analytics-and-reports/trends/)
- [Token Debugger](https://developers.pinterest.com/docs/developer-tools/token-debugger/)
- [Rate limits](https://developers.pinterest.com/docs/reference/rate-limits/)

Access tokens expire. Use the Token Debugger to check token environment,
expiry, and scope. For a long-running deployment, rotate access tokens using a
refresh token stored in the platform's secret manager; this repository never
stores refresh tokens.

## 3. Local setup

From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit the ignored `.env` file:

```dotenv
PINTEREST_ACCESS_TOKEN=your_user_authorized_token
PINTEREST_REGION=US
```

Do not place a real token in source, test fixtures, screenshots, command-line
arguments, or Git. The client never logs its Authorization header.

## 4. Run offline tests first

These tests do not need a Pinterest account, network connection, or API quota.
HTTP responses, retry sleeps, and the rate-limit clock are faked.

```powershell
python -m unittest -v test_pinterest_ingestion
```

Expected result:

```text
Ran 28 tests
OK
```

The suite covers 200/403/429 responses, all four trend types, missing growth,
token-safe logs, 20 rate-limited calls, mapping, manual CSV validation, score
breakdown, TTL purge, forbidden output fields, and the no-scraping rule.

## 5. Validate the real token and Trends entitlement

First validate the basic account endpoint:

```powershell
python probe_access.py --user-account
```

Expected: `HTTP_STATUS=200` and `USER_ACCOUNT_OK`.

Then run the mandatory Trends gate:

```powershell
python probe_access.py
```

Interpret the result exactly as follows:

- `ACCESS_OK`: the app can continue to live Trends ingestion.
- `ACCESS_DENIED_403`: the script exits successfully because this is a
  controlled entitlement outcome. Check scope/grant in Token Debugger once,
  then use Plan B below. Do not add a scraper.
- `ACCESS_ERROR_401`: token is invalid or expired.
- `ACCESS_ERROR_429`: quota/rate limit is exhausted; wait until the reset.
- Other `ACCESS_ERROR_<code>`: inspect the printed, unmodified response body.

For the first authorized call only, inspect the one-record response shape:

```powershell
python probe_access.py --show-body
```

Confirm that each `time_series` is keyed by ISO-8601 week-ending dates and its
values are 0-100 integers. Do not commit the captured raw body. The current
parser supports the documented object form and raises a descriptive error if
Pinterest changes the payload.

## 6. Live smoke test

Run one record for every official trend type:

```powershell
python smoke_pinterest.py --region US
```

Or use a single seed filter:

```powershell
python smoke_pinterest.py --region US --keyword "custom mug"
```

Expected output has four lines like:

```text
SMOKE_OK type=growing records=1 time_series_present=true
SMOKE_OK type=monthly records=1 time_series_present=true
SMOKE_OK type=yearly records=1 time_series_present=true
SMOKE_OK type=seasonal records=1 time_series_present=true
```

The calls are spaced by at least one second. `include_keywords` is serialized
as repeated query keys, as required by Pinterest's OpenAPI array definition.

## 7. Run a full seed ingestion

```powershell
python ingest_pinterest.py --region US --trend-type growing --limit 50
```

The command requests each canonical product family separately. This matters
because `normalize_against_group=true` makes interest indices comparable only
inside the same response group.

Output is written to `data/pinterest_signals.json`. Every item contains demand
metrics, mapping provenance, an explainable breakdown, collection/expiry UTC
timestamps, and no marketplace-only fields such as sales or revenue.

The spec does not yet define the product launch window. Therefore
`seasonality_fit` is missing by default and its weight is redistributed. Once
the business supplies a 0-100 fit, pass it explicitly:

```powershell
python ingest_pinterest.py --region US --trend-type growing --seasonality-fit 90
```

Never pass an assumed value merely to increase completeness.

An optional discovery pass fetches unfiltered trends. Without an injected LLM
mapper, unfamiliar phrases are deliberately retained as `UNMAPPED`:

```powershell
python ingest_pinterest.py --region US --trend-type growing --discovery
```

## 8. HTTP 403 / manual Plan B

Open Pinterest Trends manually, select the target market, review seed keywords,
and enter observations into `data/manual_pins_snapshot.csv`:

```csv
keyword,canonical_product_type,region,top_pin_theme,observed_saves,observed_at,notes
custom mug,DRINKWARE,US,retro floral,123,2026-08-21,entered manually from Pinterest Trends
```

Then run:

```powershell
python ingest_pinterest.py --manual
```

A missing manual file is valid optional input and produces zero records. An
existing file with a missing column, blank date, or invalid save count fails
with the row and reason.

Important: the manual schema has no normalized interest index or growth
components. The adapter therefore emits `pinterest_demand_score: null` and
retains the human evidence. Converting saves or a theme into a numeric score
would fabricate a rule that SPEC-001 does not define.

## 9. Storage and freshness

- Successful raw API bodies go only to `data/pinterest_cache/raw/`.
- Raw entries have a maximum six-hour TTL. Expired entries are purged before
  every cache write.
- Generated demand signals are derived data and can be retained by the product.
- Manual snapshots are human-created evidence and can be retained.
- Both `collected_at` and `expires_at` are shown in every exported signal.

To force a purge check:

```powershell
python -c "from src.pinterest_ingestion.cache import purge_expired; print('purged=', purge_expired())"
```

## 10. Known decisions still owned by the product team

- The repository catalog has 12 granular product types, while SPEC-001 defines
  five family codes (`ORNAMENT`, `DRINKWARE`, `HOME_DECOR`, `ACCESSORIES`,
  `APPAREL`). The adapter currently projects the catalog into those spec
  families. Confirm that contract before expanding the seed file.
- Define a launch window and the algorithm that produces `seasonality_fit`.
- Define a normalized manual-snapshot formula if Plan B must produce a numeric
  score. Until then, `null` is correct.
- Live `ACCESS_OK` and the production `time_series` shape cannot be certified on
  a machine without a real token. Offline test success is not a substitute for
  the access probe.
