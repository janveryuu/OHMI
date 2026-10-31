"use client";

import { useState } from "react";
import Image from "next/image";
import { getAvatar } from "@/lib/avatars";

interface UserAvatarProps {
  avatarId?: string | null;
  name?: string;
  size?: number;
  className?: string;
  priority?: boolean;
}

export function UserAvatar({
  avatarId,
  name = "A",
  size = 38,
  className = "",
  priority = false,
}: UserAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const avatar = getAvatar(avatarId);
  const initial = (name.slice(0, 1) || "A").toUpperCase();

  if (avatar && !loadFailed) {
    return (
      <span
        className={`avatar-wrapper ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${avatar.name} avatar`}
      >
        <Image
          src={avatar.src}
          alt={avatar.name}
          width={size}
          height={size}
          className="avatar-image"
          priority={priority}
          onError={() => setLoadFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`avatar-wrapper avatar-initial ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name || "User"} avatar`}
    >
      <span className="avatar-initial-text">{initial}</span>
    </span>
  );
}
