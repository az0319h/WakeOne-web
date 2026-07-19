-- E2E / verifier / 운영 수동 검증에서 생성된 목 데이터 정리 (스키마 변경 없음)
-- 실행: Supabase MCP execute_sql (또는 psql). apply_migration 사용 금지.
-- 권장: npm run e2e:cleanup (= RPC public.cleanup_e2e_mock_data)
-- 참조: .cursor/skills/e2e-remote-cleanup/SKILL.md

select public.cleanup_e2e_mock_data();
