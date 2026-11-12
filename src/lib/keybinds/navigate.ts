export type Place = "today" | number;

export function currentPlace(order: number[], activeId: number | null, todayOpen: boolean): Place {
  if (todayOpen) return "today";
  if (activeId !== null && order.includes(activeId)) return activeId;
  return order[0] ?? "today";
}

export function stepPlace(order: number[], current: Place, step: 1 | -1): Place {
  const places: Place[] = ["today", ...order];
  const index = places.indexOf(current);
  if (index === -1) return places[0];
  return places[(index + step + places.length) % places.length];
}

export function bucketAt(order: number[], number: number): number | null {
  return order[number - 1] ?? null;
}
