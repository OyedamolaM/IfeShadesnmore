/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import "../App.css";
import "../pages/PreviewStorefront.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "theme-color", content: "#f4f0e9" }
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }
    ]
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: NotFoundPage
});

export function NotFoundPage() {
  return (
    <main className="site-shell route-not-found">
      <p className="section-kicker">Not found</p>
      <h1>Page not found</h1>
      <p>The page you opened is not available. Return to the storefront or sign in to continue.</p>
      <div className="not-found-actions">
        <a className="primary-action" href="/">
          Back to Store
        </a>
        <a className="secondary-action" href="/account/login">
          Sign In
        </a>
      </div>
    </main>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-ife-theme="v1" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var k='ife_preview_theme';var m=document.cookie.match(/(?:^|; )ife_preview_theme=([^;]+)/);var t=localStorage.getItem(k)||(m&&decodeURIComponent(m[1]))||'v1';if(t!=='v2'&&t!=='v3')t='v1';document.documentElement.dataset.ifeTheme=t;}catch(e){}"
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
