import {
  Menu as MenuPrimitive,
  type MenuPortalProps,
  type MenuPositionerProps,
  type MenuPopupProps,
  type MenuItemProps,
} from "@base-ui/react/menu";
import { cn } from "cn";

const Menu = MenuPrimitive.Root;
const MenuTrigger = MenuPrimitive.Trigger;

function MenuPortal({ ...props }: MenuPortalProps) {
  return <MenuPrimitive.Portal {...props} />;
}

function MenuPositioner({ className, sideOffset = 6, ...props }: MenuPositionerProps) {
  return (
    <MenuPrimitive.Positioner
      sideOffset={sideOffset}
      className={cn("z-50 outline-none", className)}
      {...props}
    />
  );
}

function MenuPopup({ className, ...props }: MenuPopupProps) {
  return (
    <MenuPrimitive.Popup
      data-slot="menu-popup"
      className={cn(
        "min-w-48 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg outline-none",
        "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function MenuItem({ className, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        "flex cursor-pointer items-center rounded-md px-2.5 py-1.5 text-sm outline-none select-none",
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        className
      )}
      {...props}
    />
  );
}

function MenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

export { Menu, MenuTrigger, MenuPortal, MenuPositioner, MenuPopup, MenuItem, MenuSeparator };
