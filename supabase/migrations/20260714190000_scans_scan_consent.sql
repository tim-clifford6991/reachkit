-- Scan-authorisation consent (launch P3). The public scan input requires the
-- visitor to affirm "I own or am authorised to scan this URL"; we record WHEN
-- they affirmed for a liability/audit trail. Null for owner re-scans (which
-- don't surface the gate) and pre-existing rows. Additive + back-compat.
alter table scans add column if not exists scan_consent_at timestamptz;
