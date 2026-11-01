"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonDrawerProvider } from "@/components/person-drawer";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <PersonDrawerProvider>{children}</PersonDrawerProvider>
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ classNames: { toast: "font-sans" } }} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
