import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/session-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ReactQueryProvider } from "@/components/providers/react-query-provider"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { CookieSettingsButton } from "@/components/cookie-settings-button"
import { Toaster } from "sonner"
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A.S.P.M.A - Gestor de Consignados",
  description: "Plataforma de gestão de descontos em folha de pagamento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="consignado"
          enableSystem
          disableTransitionOnChange
          themes={["light", "consignado", "railway"]}
        >
          <ReactQueryProvider>
            <SessionProvider>{children}</SessionProvider>
            <CookieConsentBanner />
            <CookieSettingsButton />
            <Toaster position="top-right" richColors />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
