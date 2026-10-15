import { avatarFor } from "@/lib/account/avatar";
import { Avatar } from "./Avatar";

type PersonAvatarProps = {
  userId: number;
  avatar: string | null;
  size?: 16 | 32 | 48;
  className?: string;
};

// Always next to the person's name, so it is decoration for screen readers
export function PersonAvatar({ userId, avatar, size = 16, className }: PersonAvatarProps) {
  return <Avatar cells={avatarFor(avatar, userId)} size={size} className={className} />;
}
