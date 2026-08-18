export const timelineSeriesStyles = {
  winnerPoints: { group: "winner", stroke: "hsl(25 64% 48%)", strokeWidth: 1.5, strokeOpacity: 0.72 },
  cumulativeWinnerAverage: { group: "winner", stroke: "hsl(25 64% 34%)", strokeWidth: 3, strokeOpacity: 1 },
  gameAveragePoints: { group: "players", stroke: "hsl(154 52% 42%)", strokeWidth: 1.5, strokeOpacity: 0.72 },
  cumulativePlayerAverage: { group: "players", stroke: "hsl(154 52% 28%)", strokeWidth: 3, strokeOpacity: 1 },
} as const;

const minimumVisualGap = 1;
const maximumVisualGap = 8;
const hoursPerDay = 24;

export const compressTimelineGap = (milliseconds: number) => {
  const hours = Math.max(0, milliseconds) / (60 * 60 * 1000);
  return Math.min(maximumVisualGap, minimumVisualGap + 2 * Math.log1p(hours / hoursPerDay));
};

export function addCompressedTimelinePositions<T extends { playedAt: string }>(entries: T[]) {
  let visualPosition = 0;
  return entries.map((entry, index) => {
    const timestamp = new Date(entry.playedAt).getTime();
    if (index > 0) {
      const previousTimestamp = new Date(entries[index - 1].playedAt).getTime();
      visualPosition += compressTimelineGap(timestamp - previousTimestamp);
    }
    return { ...entry, timestamp, visualPosition };
  });
}

export function selectTimelineTicks<T>(data: T[], maximumTicks = 6): T[] {
  if (data.length <= maximumTicks) return data;
  const indexes = Array.from({ length: maximumTicks }, (_, index) => Math.round(index * (data.length - 1) / (maximumTicks - 1)));
  return indexes.map((index) => data[index]);
}
