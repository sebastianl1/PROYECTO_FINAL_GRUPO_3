import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexSCADA — Industrial Control System" },
      { name: "description", content: "NexSCADA v5.0 — Sistema SCADA industrial servido en Lovable." },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/scada/index.html");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <a
        href="/scada/index.html"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Abrir NexSCADA
      </a>
    </div>
  );
}
