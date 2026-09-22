# Commercial Evaluation: Footer Sponsorship Surface

Date: 2026-09-21
Status: ready for commercial review, disabled in source
Scope: one static, disclosed footer link rendered by `src/sponsorship.ts` when a reviewed source configuration is changed from `null` to an approved sponsor.

## Decision Summary

The current footer surface is suitable only for a direct, manually approved sponsor or a simple affiliate link whose terms allow a plain text link. It is not currently compatible with common ad-network products that require script tags, above-the-fold placement, image/text creative units, impression reporting, automatic refresh, SDKs, or network-controlled CSS.

No revenue forecast is available from repository evidence. The application has no traffic report, no billable-impression measurement, no outbound-click tracking, and no conversion data. Demo votes and local gallery entries are not audience evidence. Activation remains blocked until an operator approves a real partner, destination, disclosure, campaign period, removal owner, and applicable privacy requirements.

## Implementation Constraints Being Evaluated

- Placement: existing footer after `Saved automatically after each stroke, in this browser only.`
- Creative: one text-only anchor reading `Sponsored by [name] (external site)`.
- Navigation: ordinary HTTPS link, same tab, `rel="sponsored noopener noreferrer"`, no click listener.
- Privacy/performance: no SDK, iframe, pixel, prefetch, observer, remote campaign request, cookie, localStorage field, or background work.
- Configuration: reviewed source value in `src/sponsorship.ts`; production value remains `null`.
- Measurement: none in application code; any commercial evaluation must use partner reports, hosting reports, manual browser traces, or explicit future analytics work.

## Source Notes

Sources were accessed on 2026-09-21. These notes are implementation-fit observations, not legal clearance or provider selection.

| Candidate | Primary source | Published facts relevant to this surface | Fit |
| --- | --- | --- | --- |
| Direct fixed-fee sponsor | No operator-supplied quote or partner agreement provided | A direct sponsor can agree to a fixed fee, approved copy, approved HTTPS destination, campaign dates, and no application tracking if both parties accept manual reporting. Price, eligibility, disclosure wording, tax treatment, payout timing, and removal terms require a private agreement. | Compatible in principle; unverified commercially |
| EthicalAds publisher network | `https://www.ethicalads.io/publishers/` and `https://www.ethicalads.io/publisher-policy/` | Publisher page says the network is invite-only, targets developer-focused sites, looks for 50k+ monthly pageviews, estimates around `$2.50 per 1,000 pageviews` for EU/North America-heavy traffic, and pays after `$50`. Publisher policy requires the ad to appear above the fold on desktop and mobile, generally be the only ad on the page, reach at least `0.1%` CTR, and allows traffic validation. Integration creates an EthicalAds client request/render path. | Incompatible with this footer-only static link; maybe a future revised design |
| Carbon Ads | `https://www.carbonads.net/` and `https://www.carbonads.net/placement-policy` | Carbon describes native ads for developer/creator audiences. Its placement policy requires using dashboard ad code, not modifying or self-hosting the script, loading the ad code once per page, above-the-fold desktop visibility at `1366 x 768`, mobile appearance within `3x` viewport height or mobile disablement, full approved format display, metrics verification, and a target CTR of `0.07%`. Advertiser FAQ states no self-serve buying and typical first buys of `$5,000-$10,000` monthly over `60-90` days. | Incompatible with this static footer link; requires network ad code, creative format, and viewability expectations |
| Google AdSense | `https://support.google.com/adsense/answer/48182?hl=en` | AdSense policies require compliance with Google Publisher Policies, prohibit artificial clicks or impressions, prohibit encouraging clicks or views, require ads to be distinguishable from content, and discuss placement of AdSense code. AdSense is an ad-code product rather than a static source-configured sponsor link. | Incompatible with this implementation; would require a separate policy/privacy/performance design |
| Amazon Associates affiliate link | `https://affiliate-program.amazon.com/help/operating/agreement` and `https://affiliate-program.amazon.com/help/operating/policies` | Operating agreement permits monetization by placing properly tagged Special Links and pays commission income for qualifying purchases. It requires clear Associate identification such as `As an Amazon Associate I earn from qualifying purchases.` It also says Amazon gives no traffic or commission guarantee. Program policies require proper Special Link formatting and site responsibility for disclosures, privacy, cookies/pixels, and applicable laws. Payment minimums shown include `$10` for deposit/gift card and `$100` for check in the U.S. | Potentially compatible only if the footer points to an approved product/page using a proper Special Link and disclosure is revised; unverified for this product/audience |
| FTC disclosure guidance | `https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers` | FTC staff guidance says financial relationships should be disclosed, disclosures should be hard to miss, use simple clear language such as `ad` or `sponsored`, and appear with the endorsement message itself. | Supports visible disclosure; does not approve a partner or rate |

## Candidate Records

### Direct Fixed-Fee Sponsor

- Provider/partner: unknown; private quote required.
- Audience assumptions: unknown traffic, geography, device mix, and content-category value. The product is a browser-local street-art/train painting page, not an established developer publication.
- Currency: unknown until quoted.
- Eligibility and placement: compatible only if the sponsor accepts a static footer text link and the operator approves the sponsor/category.
- Billing basis: agreed campaign fee for agreed campaign period.
- Published fees/payouts: none available from repository evidence.
- External scripts/requests: none required by implementation; link navigation creates a request only after user activation.
- Tracking/consent: none in application; any tracking demand blocks activation pending revised design.
- Traffic evidence and confidence: unknown; no hosting report supplied.
- Compatibility: compatible in principle, unverified. Activation requires partner identity, contract/terms, campaign dates, removal owner, and operator approval.

### EthicalAds

- Provider/partner: EthicalAds publisher network.
- Source URLs and access date: `https://www.ethicalads.io/publishers/`, `https://www.ethicalads.io/publisher-policy/`, accessed 2026-09-21.
- Audience assumptions: developer-focused site; application audience evidence unavailable.
- Currency: source examples use USD.
- Eligibility and placement: invite-only; publisher form says it is looking for developer-focused sites doing `50k+ pageviews per month`. Policy expects above-the-fold display on desktop and mobile and only one EthicalAds ad per page.
- Billing basis: source estimates around `$2.50 per 1,000 pageviews`; policy references CTR validation and payout review. Net/gross details require account terms.
- Published fees/payouts: publisher policy states `70%` publisher revenue share and `$50` minimum payout.
- External scripts/requests: network client/request/render integration is expected.
- Tracking/consent: source states no tracking-based targeting; traffic validation still occurs.
- Traffic evidence and confidence: no eligible pageview evidence in repository.
- Compatibility: incompatible with current static footer surface because placement, client request, and dashboard/reporting expectations exceed this slice.

### Carbon Ads

- Provider/partner: Carbon Ads.
- Source URLs and access date: `https://www.carbonads.net/`, `https://www.carbonads.net/placement-policy`, accessed 2026-09-21.
- Audience assumptions: developer and creator audience; application audience evidence unavailable.
- Currency: source quotes typical advertiser investment in USD.
- Eligibility and placement: curated network; publisher placement policy requires dashboard ad code, unmodified script, approved creative format, above-the-fold desktop visibility, and mobile visibility within `3x` viewport height or disabled mobile ads.
- Billing basis: campaign and dashboard-managed native ads; source mentions advertiser investment, CTR target, and metrics verification, not a static fixed-fee footer link.
- Published fees/payouts: no publisher payout terms found in fetched public page; advertiser FAQ says typical first-time buys start with `$5,000-$10,000` monthly for `60-90` days.
- External scripts/requests: required by placement policy.
- Tracking/consent: dashboard metrics and verification expected.
- Traffic evidence and confidence: no publisher application/eligibility evidence in repository.
- Compatibility: incompatible with current static footer surface; requires a revised ad-network integration design.

### Google AdSense

- Provider/partner: Google AdSense.
- Source URL and access date: `https://support.google.com/adsense/answer/48182?hl=en`, accessed 2026-09-21.
- Audience assumptions: unknown; eligibility and policy review required by Google.
- Currency: not evaluated because the implementation is not an AdSense integration.
- Eligibility and placement: requires publisher policy compliance and AdSense code placement; not a static reviewed source link.
- Billing basis: Google-controlled ad serving/reporting; no repository data for billable impressions or net payout.
- Published fees/payouts: not evaluated here; would require AdSense account and reports.
- External scripts/requests: expected for AdSense ad serving.
- Tracking/consent: requires a separate privacy/consent review.
- Traffic evidence and confidence: no eligible traffic evidence in repository.
- Compatibility: incompatible with this slice.

### Amazon Associates Affiliate Link

- Provider/partner: Amazon Associates.
- Source URLs and access date: `https://affiliate-program.amazon.com/help/operating/agreement`, `https://affiliate-program.amazon.com/help/operating/policies`, accessed 2026-09-21.
- Audience assumptions: product relevance and geography unknown.
- Currency: U.S. program examples use USD; other locales have different entities/sites.
- Eligibility and placement: requires enrollment acceptance, original content/site suitability, correct Special Link formatting, and proper Associate disclosure. A generic `Sponsored by ...` label may be insufficient because Amazon requires a specific Associate identification statement or substantially similar wording.
- Billing basis: qualifying purchases or bounty/bonus events under program rules, not impressions.
- Published fees/payouts: commission percentages depend on appendix/category; payment minimums include `$10` for U.S. deposit/gift card and `$100` for U.S. check.
- External scripts/requests: simple link may be possible; if widgets/API/product content are used, extra requirements apply.
- Tracking/consent: Special Links and Amazon reporting are involved; site responsibility includes disclosures, privacy, and cookies/pixels where applicable.
- Traffic evidence and confidence: no click/conversion data in repository.
- Compatibility: unverified. Could fit a text-link architecture only after enrollment, approved product/relevance review, disclosure/privacy review, and a deliberate copy/config change.

## Commercial Models To Use

Use only sourced terms or explicitly hypothetical inputs.

```text
direct sponsorship = agreed fee for the agreed campaign period
ad revenue estimate = billable impressions / 1000 * net publisher CPM
```

Worked arithmetic examples below are not forecasts:

- Direct sponsor example: if a partner signs a contract for `$X` for `Y` days, revenue is `$X`; pageviews do not change that fixed fee unless the agreement says so.
- CPM example: if a provider report shows `N` billable impressions and a net publisher CPM of `$C`, estimated revenue is `N / 1000 * C`.
- Affiliate example: if a partner report shows `Q` qualifying clicks, `R` conversion rate, and `$K` net commission per conversion, estimated revenue is `Q * R * K`.

Do not substitute DOM mounts, local votes, gallery entries, or unit-test counts for billable impressions, clicks, conversions, or qualified purchases.

## Required Evidence Before Activation

- Real partner identity and approved destination URL.
- Written terms covering campaign period, price or payout basis, payment timing, taxes/fees, reporting source, copy approval, and removal/expiry owner.
- Disclosure/privacy review for the jurisdiction and partner type.
- Traffic evidence from authorized hosting reports or partner dashboard, if rate negotiation depends on audience.
- Paired production-build browser checks listed in `docs/monetization/launch-checklist.md`.
- Explicit operator approval for a separate config change that changes `sponsorConfig` from `null`.

## Current Release Decision

Ready-but-disabled for the local footer capability. Live activation is blocked because no partner, approved destination, commercial terms, traffic evidence, privacy review, campaign dates, or removal owner has been supplied. EthicalAds, Carbon Ads, and Google AdSense should not be activated through this footer link because their published requirements conflict with the no-SDK/no-network/static-footer design. Amazon Associates remains unverified and would require a specific affiliate disclosure and properly tagged Special Link.
