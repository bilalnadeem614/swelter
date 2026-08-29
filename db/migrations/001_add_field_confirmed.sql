-- Human audit annotation: a person physically executed the AI's recommended action.
-- Nullable, no default: null means "not yet confirmed by a human." Never read by decide()
-- or /api/check-heat — purely additive, does not gate the autonomous loop.
ALTER TABLE decisions ADD COLUMN field_confirmed_at timestamptz;
