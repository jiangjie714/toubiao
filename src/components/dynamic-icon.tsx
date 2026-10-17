import {
  ChartBarIcon,
  ClipboardIcon,
  BriefcaseIcon,
  ChatBubbleIcon,
  UsersIcon,
  ShieldCheckIcon,
  FolderIcon,
  TrophyIcon,
  DocumentTextIcon,
  BoltIcon,
  DatabaseIcon,
  HomeIcon,
  SearchIcon,
  MegaphoneIcon,
  SparklesIcon,
  CreditCardIcon,
  KeyIcon,
  DocumentPlusIcon,
  ScaleIcon,
  StarIcon,
  FunnelIcon,
  ClockIcon,
  BuildingIcon,
} from "@/components/icons";

interface DynamicIconProps {
  name?: string | null;
  className?: string;
}

export const AVAILABLE_ICONS = [
  { name: "ChartBarIcon", label: "图表/看板" },
  { name: "ClipboardIcon", label: "剪贴板/清单" },
  { name: "BriefcaseIcon", label: "公文包/项目" },
  { name: "ChatBubbleIcon", label: "气泡/反馈" },
  { name: "UsersIcon", label: "用户/团队" },
  { name: "ShieldCheckIcon", label: "盾牌/安全" },
  { name: "FolderIcon", label: "文件夹/资产" },
  { name: "TrophyIcon", label: "奖杯/VIP" },
  { name: "DocumentTextIcon", label: "文书/发票" },
  { name: "BoltIcon", label: "闪电/事件" },
  { name: "DatabaseIcon", label: "数据库/爬虫" },
  { name: "HomeIcon", label: "首页/日志" },
  { name: "SearchIcon", label: "搜索/检索" },
  { name: "MegaphoneIcon", label: "喇叭/雷达" },
  { name: "SparklesIcon", label: "星芒/AI智能" },
  { name: "CreditCardIcon", label: "卡片/保证金" },
  { name: "KeyIcon", label: "钥匙/权限" },
  { name: "DocumentPlusIcon", label: "装配/立项" },
  { name: "ScaleIcon", label: "天平/复盘" },
  { name: "StarIcon", label: "星星/收藏" },
  { name: "FunnelIcon", label: "漏斗/CRM" },
  { name: "ClockIcon", label: "时钟/历史" },
  { name: "BuildingIcon", label: "建筑/企业组织" },
];

export default function DynamicIcon({ name, className = "h-4 w-4" }: DynamicIconProps) {
  switch (name) {
    case "ChartBarIcon":
      return <ChartBarIcon className={className} />;
    case "ClipboardIcon":
      return <ClipboardIcon className={className} />;
    case "BriefcaseIcon":
      return <BriefcaseIcon className={className} />;
    case "ChatBubbleIcon":
      return <ChatBubbleIcon className={className} />;
    case "UsersIcon":
      return <UsersIcon className={className} />;
    case "ShieldCheckIcon":
      return <ShieldCheckIcon className={className} />;
    case "TrophyIcon":
      return <TrophyIcon className={className} />;
    case "DocumentTextIcon":
      return <DocumentTextIcon className={className} />;
    case "BoltIcon":
      return <BoltIcon className={className} />;
    case "DatabaseIcon":
      return <DatabaseIcon className={className} />;
    case "HomeIcon":
      return <HomeIcon className={className} />;
    case "SearchIcon":
      return <SearchIcon className={className} />;
    case "MegaphoneIcon":
      return <MegaphoneIcon className={className} />;
    case "SparklesIcon":
      return <SparklesIcon className={className} />;
    case "CreditCardIcon":
      return <CreditCardIcon className={className} />;
    case "KeyIcon":
      return <KeyIcon className={className} />;
    case "DocumentPlusIcon":
      return <DocumentPlusIcon className={className} />;
    case "ScaleIcon":
      return <ScaleIcon className={className} />;
    case "StarIcon":
      return <StarIcon className={className} />;
    case "FunnelIcon":
      return <FunnelIcon className={className} />;
    case "ClockIcon":
      return <ClockIcon className={className} />;
    case "BuildingIcon":
      return <BuildingIcon className={className} />;
    case "FolderIcon":
    default:
      return <FolderIcon className={className} />;
  }
}
