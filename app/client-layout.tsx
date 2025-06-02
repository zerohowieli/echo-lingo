"use client";

import dynamic from "next/dynamic";

// 动态导入 TitleBar 组件，避免 SSR 时报错
const TitleBar = dynamic(() => import("@/app/components/ui/titlebar").then(mod => mod.TitleBar), {
  ssr: false
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TitleBar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </>
  );
} 