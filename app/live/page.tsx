"use client";

import dynamic from "next/dynamic";

// Live restores the session from browser storage and reads the URL, neither of which
// the server can see, so server-rendered HTML wouldn't match what the browser shows.
const LiveScreen = dynamic(() => import("./live-screen").then((mod) => mod.LiveScreen), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-background" />,
});

export default function LivePage() {
  return <LiveScreen />;
}
