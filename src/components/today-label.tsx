"use client";

import { useSyncExternalStore } from "react";

/** 本地日期只在浏览器计算；服务端快照为空，避免时区不同导致的 hydration 不匹配。 */
function subscribe() {
  return () => {};
}

function getSnapshot() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function getServerSnapshot() {
  return "";
}

export function TodayLabel({ className }: { className?: string }) {
  const label = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <p className={className}>{label}</p>;
}