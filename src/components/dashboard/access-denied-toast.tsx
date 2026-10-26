"use client";

import { useEffect, useRef } from "react";
import {
  clearAccessDeniedFlash,
  readAccessDeniedFlash,
} from "@/lib/auth/access-denied-flash";
import { notifyError } from "@/lib/notify";

const ACCESS_DENIED_MESSAGES: Record<string, string> = {
  users: "이 페이지에 접근할 권한이 없습니다.",
  benefits: "이 페이지에 접근할 권한이 없습니다.",
  "workflow-settings": "워크플로우 관리자 권한이 필요합니다.",
  // plan 89 — 동방특송 allowlist 밖 (키는 `src/config/dongbang-routes.ts`)
  dongbang: "동방특송 계정은 퀵 화면만 이용할 수 있습니다.",
  "dongbang-quick-request": "동방특송 계정은 퀵 요청을 등록할 수 없습니다.",
};

function readLegacyAccessDeniedParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("accessDenied");
}

function stripLegacyAccessDeniedParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("accessDenied")) {
    return;
  }
  url.searchParams.delete("accessDenied");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function AccessDeniedToast() {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    let key = readAccessDeniedFlash();
    if (key) {
      clearAccessDeniedFlash();
    } else {
      key = readLegacyAccessDeniedParam();
      if (key) {
        stripLegacyAccessDeniedParam();
      }
    }

    if (!key || !ACCESS_DENIED_MESSAGES[key]) {
      return;
    }

    handledRef.current = true;
    notifyError(ACCESS_DENIED_MESSAGES[key]);
  }, []);

  return null;
}
