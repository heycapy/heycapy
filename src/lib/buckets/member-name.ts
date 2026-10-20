// How a person is called to the others in a bucket, never the email
export function memberName(person: { username: string | null }): string {
  return person.username ?? "someone";
}
