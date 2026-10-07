-- 2026-10-06: cleanup_e2e_mock_data wallet_syncs trigger enable typo fix
-- File: 71_e2e_cleanup_fix_wallet_syncs_trigger.sql
-- Status: Completed (remote applied via migration e2e_cleanup_fix_wallet_syncs_trigger_enable)
-- Summary: v70 restore 시 wallet_syncs enable trigger가 trg_activity_logs_no_update로 잘못 적용된 버그 수정

-- Full function body matches 70_e2e_cleanup_test_com_profiles.sql (correct trg_wallet_syncs_no_update on enable).
-- See 70_e2e_cleanup_test_com_profiles.sql for the canonical definition.
