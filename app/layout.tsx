export const metadata = {
  title: "Counter Dummy",
  description: "Stack-Test für die Elo-App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: 0,
          background: "#0f172a",
          color: "#f1f5f9",
        }}
      >
        {children}
      </body>
    </html>
  );
}
