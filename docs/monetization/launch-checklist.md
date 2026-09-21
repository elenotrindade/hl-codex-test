# Footer Sponsorship Launch Checklist

Date: 2026-09-21
Status: disabled code shipped; launch not approved

This checklist defines the approval boundary for the footer sponsorship link. It is not an automatic runtime switch and does not authorize a live sponsor. Production remains disabled while `sponsorConfig` is `null`.

## Launch Flow

```text
disabled code shipped
  -> compatible partner + reviewed terms and destination
  -> disclosure/privacy review + campaign period and removal owner
  -> paired-browser checks passed
  -> explicit operator approval
  -> separate reviewed config change + deployment
removal: set config to null -> test/build -> deploy -> verify footer absent
```

## Approval Gates

| Gate | Owner | Evidence | Status |
| --- | --- | --- | --- |
| Partner identity approved | Operator | Sponsor name, category, destination owner, conflict review | Blocked: no partner supplied |
| Commercial terms reviewed | Operator/legal/finance as applicable | Campaign period, fee or payout basis, payment timing, fees/taxes, reporting source | Blocked: no terms supplied |
| Destination approved | Operator/security/privacy as applicable | HTTPS URL, no credentials, no malware/phishing concern, no misleading redirect | Blocked: no destination supplied |
| Disclosure approved | Operator/legal/privacy as applicable | Final footer copy and any required affiliate or jurisdiction-specific language | Blocked: generic copy only |
| Privacy requirements reviewed | Operator/privacy as applicable | Confirmation that the chosen partner does not require tracking, SDKs, cookies, pixels, consent changes, or new storage; otherwise revised design required | Blocked until partner known |
| Campaign expiration owner assigned | Operator | Named person or role responsible for removal on expiration | Blocked: no owner assigned |
| Paired-browser evidence captured | Implementer/operator | Matrix in this file completed for disabled and fixture-enabled builds | Pending manual browser verification |
| Explicit activation approval | Operator | Written approval for a separate config change | Blocked |

## Configuration Procedure

1. Confirm all approval gates are complete.
2. Create a separate reviewed change that edits only `src/sponsorship.ts` for the approved sponsor value unless tests or docs must change for approved disclosure wording.
3. Keep the sponsor in reviewed source configuration, not in query strings, localStorage, gallery records, environment variables, or task documents.
4. Use a nonblank approved sponsor name and an absolute HTTPS URL without embedded credentials.
5. Run `npm test -- --run`, `npm run build`, and `git diff --check`.
6. Inspect the diff for no credentials, no tracking code, no SDK, no iframe, no prefetch/preconnect, no click listener, no storage schema change, and no painter/export/gallery contract changes.
7. Deploy through the normal release process.
8. Verify the production footer shows the approved disclosure and link only after deployment.

## Removal Procedure

1. Edit `src/sponsorship.ts` so `sponsorConfig` is `null`.
2. Run `npm test -- --run`, `npm run build`, and `git diff --check`.
3. Inspect the diff to confirm the sponsor name and destination have been removed from source.
4. Deploy through the normal release process.
5. Verify the footer contains only the browser-local saving notice and has no sponsor gap, placeholder, or link.

## Browser Evidence Plan

Compare production builds from the same post-feature source with only the sponsor configuration changing between `null` and a local test fixture. Restore `null` before committing or delivering production code. Record extension traffic separately from application traffic.

### Environment Record

| Item | Disabled build | Fixture-enabled build |
| --- | --- | --- |
| Git commit or diff label | Pending | Pending |
| Browser and version | Pending | Pending |
| OS/device | Pending | Pending |
| DPR | Pending | Pending |
| Throttling settings | Pending | Pending |
| Artwork fixture | Pending | Pending |
| Gallery fixture | Pending | Pending |
| Sample count | Pending | Pending |

### Layout And Accessibility Matrix

| Viewport | Disabled canvas/tools bounds | Enabled canvas/tools bounds | Overflow | Disclosure/focus/zoom/forced-colors result | Status |
| --- | --- | --- | --- | --- | --- |
| 280px | Pending | Pending | Pending | Pending | Pending |
| 390px | Pending | Pending | Pending | Pending | Pending |
| 768px | Pending | Pending | Pending | Pending | Pending |
| 1200px | Pending | Pending | Pending | Pending | Pending |
| 1680px | Pending | Pending | Pending | Pending | Pending |

Acceptance criteria: no new horizontal overflow, obscured controls, lost keyboard focus, sponsor-attributable layout shift, or workshop-size change. Long sponsor names must wrap without hiding disclosure. Footer height may increase.

### Network And Performance Checks

| Check | Disabled result | Fixture-enabled result | Status |
| --- | --- | --- | --- |
| Initial production Network trace before interaction | Pending | Pending | Pending |
| Third-party requests attributable to sponsorship | Pending | Pending | Pending |
| Frames/scripts/beacons/preconnects/prefetches | Pending | Pending | Pending |
| Periodic work while idle | Pending | Pending | Pending |
| Repeated load timings, at least five samples | Pending | Pending | Pending |
| Painting run timings and long-task notes, at least five samples | Pending | Pending | Pending |
| Resize timings and long-task notes, at least five samples | Pending | Pending | Pending |
| PNG export timings and long-task notes, at least five samples | Pending | Pending | Pending |

Acceptance criteria: no added third-party request before following the link, no sponsor-attributable script/frame/beacon/preconnect/prefetch, no periodic sponsor work, and no repeatable slowdown beyond baseline variation. Do not invent a millisecond budget until baseline variation is measured.

### Functional Checks

| Scenario | Disabled result | Fixture-enabled result | Invalid-config result | Status |
| --- | --- | --- | --- | --- |
| Scene switching | Pending | Pending | Pending | Pending |
| Undo/redo | Pending | Pending | Pending | Pending |
| Local publication and voting | Pending | Pending | Pending | Pending |
| Download PNG | Pending | Pending | Pending | Pending |
| Share image | Pending | Pending | Pending | Pending |
| Saved records contain no sponsor data | Pending | Pending | Pending | Pending |
| Exported PNG contains no sponsor data | Pending | Pending | Pending | Pending |
| Blocked/unreachable sponsor destination leaves app usable before link activation | Not applicable | Pending | Pending | Pending |

## Evidence From Automated Checks

Current automated checks for this Phase 2 documentation change should include:

- `npm test -- --run`
- `npm run build`
- `git diff --check`
- Diff inspection confirming no enabled test advertiser, no secrets, no dependency changes, and no unintended application changes.

Browser checks remain manual because the repository currently has no persistent browser automation dependency or script in `package.json`. Do not add one for this initial slice unless a future design revises the resolved approach.

## Commercial Review Checklist

- Every commercial claim in `docs/monetization/commercial-evaluation.md` has a source URL or is marked as unknown/private quote required.
- Provider requirements are not broadened into implementation changes without a revised design.
- Support receipts, advertising estimates, and settled ad payouts are tracked separately.
- No credentials, dashboard screenshots with secrets, private quote details, tax IDs, account IDs, or payout details are committed.
- Decision is recorded as one of: `ready-but-disabled`, `blocked: no partner`, `blocked: incompatible provider`, `blocked: privacy/legal`, `blocked: performance/layout`, or `approved for separate activation change`.

Current decision: `ready-but-disabled` for the code capability and `blocked: no partner` for live activation.
