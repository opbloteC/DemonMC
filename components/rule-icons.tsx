import type { ComponentType, SVGProps } from "react";
import {
  AlertIcon,
  BanIcon,
  BugIcon,
  CubeIcon,
  CrownIcon,
  EyeIcon,
  HeartIcon,
  LockIcon,
  MegaphoneIcon,
  MessageIcon,
  MonitorIcon,
  RepeatIcon,
  ServerIcon,
  ShieldIcon,
  SwordIcon,
  UsersIcon,
  WrenchIcon,
} from "@/components/icons";
import type { RuleIcon } from "@/lib/rule-types";

const RULE_ICON_COMPONENTS: Record<RuleIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  shield: ShieldIcon,
  sword: SwordIcon,
  message: MessageIcon,
  monitor: MonitorIcon,
  heart: HeartIcon,
  users: UsersIcon,
  eye: EyeIcon,
  repeat: RepeatIcon,
  wrench: WrenchIcon,
  bug: BugIcon,
  ban: BanIcon,
  megaphone: MegaphoneIcon,
  lock: LockIcon,
  cube: CubeIcon,
  server: ServerIcon,
  crown: CrownIcon,
  alert: AlertIcon,
};

export function RuleGlyph({
  icon,
  ...props
}: { icon: RuleIcon } & SVGProps<SVGSVGElement>) {
  const Component = RULE_ICON_COMPONENTS[icon] ?? ShieldIcon;
  return <Component {...props} />;
}
