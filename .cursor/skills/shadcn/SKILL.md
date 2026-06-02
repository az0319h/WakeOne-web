---
name: shadcn
description: WakeOne용 shadcn/ui 구현 가이드. 컴포넌트 추가/수정 시 shadcn MCP를 먼저 사용하고, 프로젝트 UI 규칙을 준수한다.
---

# WakeOne shadcn Skill

## When to use

- shadcn 컴포넌트를 추가/조합/스타일링할 때
- Dialog, Sheet, Form, Table, Sidebar 같은 UI를 구현할 때
- 기존 UI를 접근성/일관성 기준으로 정리할 때

## Required workflow

1. 먼저 shadcn MCP로 현재 컴포넌트/패턴을 조회한다.
2. 프로젝트 설정(`components.json`)을 확인한다.
3. 기존 `src/components/ui/` 컴포넌트와 레이아웃 패턴을 재사용한다.
4. 필요 시 새 컴포넌트를 추가하되, 디자인 토큰과 규칙을 유지한다.

## WakeOne constraints

- `components.json` 기준: style은 `new-york`, Tailwind CSS variables 사용
- 아이콘은 `@/components/icons`만 사용 (직접 tabler import 금지)
- 페이지 헤더는 `PageContainer` props를 사용 (`Heading` 직접 import 금지)
- 클래스 병합은 `cn()` 사용
- `src/components/ui/` 파일 직접 수정은 지양하고 조합/확장 우선

## Design consistency checklist

- 상태(hover/focus/disabled/loading) 표시가 있는가
- 다크/라이트 테마에서 토큰이 깨지지 않는가
- 키보드 접근성과 ARIA 속성이 적절한가
- 폼/에러 메시지 표현이 `docs/forms.md` 패턴과 일치하는가
