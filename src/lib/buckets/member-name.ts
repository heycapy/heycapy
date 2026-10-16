// How a person is called to the others in a bucket; never the email
export function memberName(person: {
  displayName: string | null;
  username: string | null;
}): string {
  return person.displayName ?? person.username ?? "someone";
}
