import { Navigation } from "./navigation";
import "./site.css";
import "./profile.css";
import "./avatar-layouts.css";

export const metadata = {
  title: "ZugUmZugElo",
  description: "Rangliste und Partieerfassung für Zug um Zug",
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
          background: "#f7f4ec",
          color: "#17231e",
        }}
      >
        <Navigation />
        {children}
      </body>
    </html>
  );
}
