import { Archive } from "pixelarticons/react/Archive.js";
import { ArrowLeft } from "pixelarticons/react/ArrowLeft.js";
import { ArrowUp } from "pixelarticons/react/ArrowUp.js";
import { Bell } from "pixelarticons/react/Bell.js";
import { Briefcase } from "pixelarticons/react/Briefcase.js";
import { Bulletlist } from "pixelarticons/react/Bulletlist.js";
import { Calendar } from "pixelarticons/react/Calendar.js";
import { ChartLine } from "pixelarticons/react/ChartLine.js";
import { Check } from "pixelarticons/react/Check.js";
import { ChevronLeft } from "pixelarticons/react/ChevronLeft.js";
import { ChevronRight } from "pixelarticons/react/ChevronRight.js";
import { Clock } from "pixelarticons/react/Clock.js";
import { Close } from "pixelarticons/react/Close.js";
import { Collapse } from "pixelarticons/react/Collapse.js";
import { CreditCard } from "pixelarticons/react/CreditCard.js";
import { Eye } from "pixelarticons/react/Eye.js";
import { EyeOff } from "pixelarticons/react/EyeOff.js";
import { Logout } from "pixelarticons/react/Logout.js";
import { Map as MapIcon } from "pixelarticons/react/Map.js";
import { Megaphone } from "pixelarticons/react/Megaphone.js";
import { Message } from "pixelarticons/react/Message.js";
import { Mic } from "pixelarticons/react/Mic.js";
import { Minus } from "pixelarticons/react/Minus.js";
import { MoreHorizontal } from "pixelarticons/react/MoreHorizontal.js";
import { Package } from "pixelarticons/react/Package.js";
import { Pencil } from "pixelarticons/react/Pencil.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { Reload } from "pixelarticons/react/Reload.js";
import { Scale } from "pixelarticons/react/Scale.js";
import { Search } from "pixelarticons/react/Search.js";
import { SlidersHorizontal } from "pixelarticons/react/SlidersHorizontal.js";
import { Square } from "pixelarticons/react/Square.js";
import { Trash } from "pixelarticons/react/Trash.js";
import { UserPlus } from "pixelarticons/react/UserPlus.js";
import { WarningDiamond } from "pixelarticons/react/WarningDiamond.js";
import { GripIcon } from "../GripIcon";
import type { IconSet } from "../icons";

// 12px is half of pixelarticons' 24px grid: the only small size where crispEdges keeps every icon even
export const PIXEL_ICON_SET: IconSet = {
  size: 12,
  svg: { shapeRendering: "crispEdges" },
  icons: {
    archive: Archive,
    "arrow-left": ArrowLeft,
    "arrow-up": ArrowUp,
    bell: Bell,
    briefcase: Briefcase,
    calendar: Calendar,
    chart: ChartLine,
    check: Check,
    "chevron-left": ChevronLeft,
    "chevron-right": ChevronRight,
    clock: Clock,
    close: Close,
    collapse: Collapse,
    "credit-card": CreditCard,
    expand: Scale,
    eye: Eye,
    "eye-off": EyeOff,
    grip: GripIcon,
    list: Bulletlist,
    logout: Logout,
    map: MapIcon,
    megaphone: Megaphone,
    message: Message,
    mic: Mic,
    minus: Minus,
    more: MoreHorizontal,
    package: Package,
    pencil: Pencil,
    plus: Plus,
    reload: Reload,
    search: Search,
    sliders: SlidersHorizontal,
    square: Square,
    trash: Trash,
    "user-plus": UserPlus,
    warning: WarningDiamond,
  },
};
