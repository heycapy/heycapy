import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { cn } from "@/lib/utils";
import { ASSIGNEE_STACK_MAX } from "./constants";
import type { ItemAssignee } from "./ItemRow";

// One person is shown with their name, a few are a stack of faces
export function AssigneeStack({ people }: { people: ItemAssignee[] }) {
  if (people.length === 1) {
    const [person] = people;
    return (
      <span className={cn(person.isYou && "text-foreground")}>
        <PersonAvatar
          userId={person.userId}
          avatar={person.avatar}
          className={cn("mr-1 inline-block align-text-bottom", !person.isYou && "@max-lg:mr-0")}
        />
        {/* Narrow lists show other people by their face only; "you" keeps its word */}
        <span className={cn(!person.isYou && "@max-lg:sr-only")}>{person.name}</span>
      </span>
    );
  }
  const shown = people.slice(0, ASSIGNEE_STACK_MAX);
  return (
    <span className="inline-flex items-center">
      {shown.map((person, index) => (
        <PersonAvatar
          key={person.userId}
          userId={person.userId}
          avatar={person.avatar}
          className={cn("ring-background inline-block ring-2", index > 0 && "-ml-1")}
        />
      ))}
      {people.length > shown.length && (
        <span className="ml-1">+{people.length - shown.length}</span>
      )}
      <span className="sr-only">{people.map((person) => person.name).join(", ")}</span>
    </span>
  );
}
