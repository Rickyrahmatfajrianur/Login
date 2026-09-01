import "./globals.css";

export const metadata = {
  title: "Admin — Taniku Agro",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <script
          // Set tema sebelum React sempat render/hydrate, biar preferensi mode
          // gelap yang tersimpan nggak sempat "kedip" ke mode terang dulu.
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
