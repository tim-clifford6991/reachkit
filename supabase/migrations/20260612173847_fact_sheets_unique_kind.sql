-- Unique index needed for subject-keyed upsert (onConflict: "subject_type,subject_key,kind").
-- The non-unique fact_sheets_subject_idx from the warehouse migration remains for non-upsert lookups;
-- this additional unique index is required by PostgreSQL's ON CONFLICT clause.
create unique index fact_sheets_subject_kind_uniq on fact_sheets (subject_type, subject_key, kind);
