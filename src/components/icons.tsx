import {
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconBell,
  IconBold,
  IconBox,
  IconBrandGithub,
  IconBrandTwitter,
  IconBrightness,
  IconCalendar,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronsDown,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircle,
  IconCircleCheck,
  IconCirclePlus,
  IconCircleX,
  IconClipboardText,
  IconClock,
  IconCode,
  IconCommand,
  IconCreditCard,
  IconDeviceLaptop,
  IconDots,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFileText,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileZip,
  IconFolder,
  IconGripVertical,
  IconHelpCircle,
  IconInfoCircle,
  IconItalic,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconLayoutSidebar,
  IconLoader2,
  IconLock,
  IconLogin,
  IconLogout,
  IconMessage,
  IconMinus,
  IconMoon,
  IconMusic,
  IconPalette,
  IconPaperclip,
  IconPhone,
  IconPhoto,
  IconPizza,
  IconPlus,
  IconProps,
  IconRosetteDiscountCheck,
  IconSearch,
  IconSelector,
  IconSend,
  IconSettings,
  IconShare,
  IconSlash,
  IconSparkles,
  IconStack2,
  IconStar,
  IconSun,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconTypography,
  IconUnderline,
  IconUpload,
  IconUser,
  IconUserCircle,
  IconUserEdit,
  IconUserX,
  IconUsers,
  IconVideo,
  IconWallet,
  IconCrown,
  IconX
} from '@tabler/icons-react';

export type Icon = React.ComponentType<IconProps>;

function GoogleBrandIcon({ className }: IconProps) {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className={className}>
      <path
        fill='#4285F4'
        d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
      />
      <path
        fill='#34A853'
        d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
      />
      <path
        fill='#FBBC05'
        d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
      />
      <path
        fill='#EA4335'
        d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
      />
    </svg>
  );
}

export const Icons = {
  // General
  alertCircle: IconAlertCircle,
  warning: IconAlertTriangle,
  arrowRight: IconArrowRight,
  check: IconCheck,
  checks: IconChecks,
  circleCheck: IconCircleCheck,
  close: IconX,
  clock: IconClock,
  code: IconCode,
  dots: IconDots,
  ellipsis: IconDotsVertical,
  externalLink: IconExternalLink,
  help: IconHelpCircle,
  info: IconInfoCircle,
  spinner: IconLoader2,
  search: IconSearch,
  settings: IconSettings,
  trash: IconTrash,

  // Navigation / Chevrons
  chevronDown: IconChevronDown,
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
  chevronUp: IconChevronUp,
  chevronsDown: IconChevronsDown,
  chevronsLeft: IconChevronsLeft,
  chevronsRight: IconChevronsRight,
  chevronsUpDown: IconSelector,

  // Layout
  dashboard: IconLayoutDashboard,
  kanban: IconLayoutKanban,
  panelLeft: IconLayoutSidebar,

  // User
  user: IconUser,
  user2: IconUserCircle,
  account: IconUserCircle,
  profile: IconUser,
  employee: IconUserX,
  userPen: IconUserEdit,
  teams: IconUsers,

  // Brand
  github: IconBrandGithub,
  twitter: IconBrandTwitter,
  google: GoogleBrandIcon,
  logo: IconCommand,

  // Communication
  chat: IconMessage,
  notification: IconBell,
  phone: IconPhone,
  video: IconVideo,
  send: IconSend,
  paperclip: IconPaperclip,

  // Files
  page: IconFile,
  post: IconFileText,
  fileTypePdf: IconFileTypePdf,
  fileTypeDoc: IconFileTypeDoc,
  fileTypeXls: IconFileTypeXls,
  fileZip: IconFileZip,
  media: IconPhoto,
  music: IconMusic,

  // Actions
  add: IconPlus,
  download: IconDownload,
  edit: IconEdit,
  upload: IconUpload,
  share: IconShare,
  login: IconLogin,
  logout: IconLogout,
  gripVertical: IconGripVertical,

  // Shapes / Indicators
  circle: IconCircle,
  circleX: IconCircleX,
  plusCircle: IconCirclePlus,
  xCircle: IconCircleX,
  minus: IconMinus,

  // Theme
  sun: IconSun,
  moon: IconMoon,
  brightness: IconBrightness,
  laptop: IconDeviceLaptop,
  palette: IconPalette,

  // Commerce / Plans
  billing: IconCreditCard,
  creditCard: IconCreditCard,
  product: IconBox,
  pro: IconCrown,
  exclusive: IconStar,
  sparkles: IconSparkles,
  badgeCheck: IconRosetteDiscountCheck,
  lock: IconLock,

  // Data / Charts
  trendingDown: IconTrendingDown,
  trendingUp: IconTrendingUp,
  eye: IconEye,
  eyeOff: IconEyeOff,
  wallet: IconWallet,
  adjustments: IconAdjustmentsHorizontal,

  // Text formatting
  bold: IconBold,
  italic: IconItalic,
  underline: IconUnderline,
  text: IconTypography,

  // Toast
  toastSuccess: IconCircleCheck,
  toastInfo: IconInfoCircle,
  toastWarning: IconAlertTriangle,
  toastError: IconCircleX,
  toastLoading: IconLoader2,

  // Misc
  pizza: IconPizza,
  workspace: IconFolder,
  forms: IconClipboardText,
  slash: IconSlash,
  calendar: IconCalendar,
  galleryVerticalEnd: IconStack2,
  moreHorizontal: IconDots
};
