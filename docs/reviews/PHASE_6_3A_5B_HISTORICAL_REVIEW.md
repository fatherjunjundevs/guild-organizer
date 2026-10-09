# Historical local fixture review — no deletion authorization

The read-only inventory identifies **338 historical fixture Guild/account pairs**: 143 Event Builder, 117 Owner/roster and 78 role fixtures. Local totals are 339 Guilds and 339 Auth accounts; the unmatched Guild/account is listed separately and excluded from the proposed deletion list. No historical records were deleted.

The previously reported 19 original-audit and 17 authorization-repair pairs are the Event Builder subsets of those validation windows. The inventory also found other roster/role fixtures from the same runs and older checkpoints. There are 302 additional marked pairs beyond the reported 36. All 338 candidates have matching exact email/name UUID markers, one active Owner membership, close creation timestamps and no discovered application profile references outside their respective Guild. No candidates were held as ambiguous by these checks. These legacy markers corroborate origin; they do **not** replace explicit approval or the new lifecycle's admin-controlled ownership tags.

This Git-safe summary intentionally omits exact record identifiers, account emails, Guild names, personal paths and database/container identities. Detailed evidence and the unchanged proposed candidate list are local-only; see [storage and inspection instructions](../LOCAL_E2E_FIXTURES.md#historical-inventory-and-prohibited-operations). The originals are in `phase-6-3a5b-originals` under the documented local-only inventory directory, not in this repository. They were copied and hash/length verified before removal from the repository.

| Cohort | All marked pairs | Previously reported Event Builder subset |
|---|---:|---:|
| Original audit validation | 34 | 19 |
| Authorization repair validation | 32 | 17 |
| Earlier validation | 272 | Not separately reported |
| Total | 338 | 36 across the two reported windows |

The frozen inventory has 338 proposed pairs, zero held pairs, one unmatched Guild and one unmatched account excluded, and zero discovered application profile references outside candidate Guilds. Matching markers, timestamps and relationships are corroborating findings, not proof of ownership equivalent to the new lifecycle manifests. Catalog-derived reference checks cannot establish the absence of dependencies outside the inspected schema or changes after capture. Fresh inspection and exact-ID independent approval remain necessary. **Historical deletion remains unapproved.**

## Proposed separately approved repair

1. Independently review and approve an exact frozen list of Guild/Auth ID pairs from the proposed inventory. Exclude the unmatched account/Guild; hold any newly ambiguous pair.
2. Stop relevant local test runs. Revalidate repository, Docker project/workdir, loopback API/Auth destinations, database system/container/OID identity. A changed target requires a new inventory and approval.
3. Re-read each approved ID's exact name, email, creator, creation timestamps, Owner/membership relationships, dependency footprint and outside references. Any difference from the approved inventory stops that pair for review. Do not infer ownership from a prefix or timestamp alone.
4. In a local-only guarded operation, lock each verified Guild, remove restrictive dependents in order, delete the Guild and verify all its scoped records are gone. Keep triggers/RLS and sealed-publication guards intact. Only then delete that approved Auth account through local Auth Admin and verify related records. Cleanup errors fail the operation and retain evidence; repeat only after another exact verification.
5. Compare completed deletions against the frozen approved list and produce before/after counts and a retained failure list. Do not claim a fully clean database while intentionally preserved historical or unmatched resources remain.

This checkpoint provides **no executable historical deletion command**. The new automatic recovery utility cannot adopt these unmanifested legacy fixtures. Implement any historical cleanup only as a separately reviewed, explicitly approved local operator workflow; do not add production grants, migrations, public endpoints or a prefix-based backdoor.
