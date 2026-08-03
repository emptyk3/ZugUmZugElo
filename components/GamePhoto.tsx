type GamePhotoProps = {
  photoUrl: string | null;
  alt: string;
  className?: string;
};

export default function GamePhoto({ photoUrl, alt, className }: GamePhotoProps) {
  if (!photoUrl) return <p style={{ padding: "1rem", borderRadius: ".75rem", background: "#f3f5f4", color: "#67736d", textAlign: "center" }}>Für diese ältere Partie wurde kein Foto gespeichert.</p>;
  return (
    <a className={className} href={photoUrl} target="_blank" rel="noreferrer" aria-label={`${alt} in größerer Ansicht öffnen`} style={{ display: "block", overflow: "hidden", borderRadius: ".75rem", background: "#edf1ee", aspectRatio: "16 / 9" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt={alt} loading="lazy" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
    </a>
  );
}
