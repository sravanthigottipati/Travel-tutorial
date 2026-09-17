"use client";

import { signOut } from "next-auth/react";
import {
  Menu,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/menu";

type Props = {
  name: string;
  email: string;
};

export function UserMenu({ name, email }: Props) {
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm hover:bg-muted">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {initial}
        </span>
        <span className="max-w-40 truncate text-muted-foreground">{email}</span>
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner align="end">
          <MenuPopup>
            <div className="flex flex-col px-2.5 py-1.5">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
            <MenuSeparator />
            <MenuItem onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</MenuItem>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}
