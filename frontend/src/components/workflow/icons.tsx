/**
 * Centralized icon mapping for the workflow editor.
 *
 * Maps semantic icon names (used by backend node definitions & CATEGORY_INFO)
 * to Lucide React components.  All icons are MIT-licensed (lucide-react).
 *
 * Usage:
 *   import { NodeIcon } from './icons';
 *   <NodeIcon name="bot" size={16} className="text-blue-500" />
 */

import {
  // Model category
  Bot,
  Split,
  Zap,
  MessageCircle,
  ClipboardCheck,
  // Task category
  ListTodo,
  Hammer,
  BadgeCheck,
  Target,
  // Logic category
  GitBranch,
  Fence,
  BarChart3,
  PenLine,
  // Memory category
  Brain,
  FileText,
  // Guard / Resilience category
  ShieldCheck,
  Pin,
  // Special / Start / End
  Play,
  Square,
  // Structured Output
  Ruler,
  // UI — Toolbar
  Plus,
  Save,
  Copy,
  Trash2,
  ScanSearch,
  Pencil,
  Check,
  X,
  AlertTriangle,
  // UI — Canvas / PropertyPanel / CompiledView
  Workflow,
  Settings,
  ChevronDown,
  ChevronRight,
  Diamond,
  LayoutList,
  ArrowRight,
  Code2,
  type LucideProps,
} from 'lucide-react';
import { memo, type FC } from 'react';

// ── Icon Registry ──

const ICON_MAP: Record<string, FC<LucideProps>> = {
  // Model nodes
  bot: Bot,
  split: Split,
  zap: Zap,
  'message-circle': MessageCircle,
  'clipboard-check': ClipboardCheck,

  // Task nodes
  'list-todo': ListTodo,
  hammer: Hammer,
  'badge-check': BadgeCheck,
  target: Target,

  // Logic nodes
  'git-branch': GitBranch,
  fence: Fence,
  'bar-chart': BarChart3,
  'pen-line': PenLine,

  // Memory nodes
  brain: Brain,
  'file-text': FileText,

  // Resilience / Guard
  'shield-check': ShieldCheck,
  pin: Pin,

  // Special
  play: Play,
  square: Square,

  // Structured output badge
  ruler: Ruler,

  // Toolbar
  plus: Plus,
  save: Save,
  copy: Copy,
  trash: Trash2,
  'scan-search': ScanSearch,
  pencil: Pencil,
  check: Check,
  x: X,
  'alert-triangle': AlertTriangle,

  // UI elements
  workflow: Workflow,
  settings: Settings,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  diamond: Diamond,
  'layout-list': LayoutList,
  'arrow-right': ArrowRight,
  code: Code2,
};

// ── Category Icons ──

export const CATEGORY_ICONS: Record<string, string> = {
  special: 'zap',
  model: 'bot',
  task: 'list-todo',
  logic: 'git-branch',
  memory: 'brain',
  resilience: 'shield-check',
};

// ── Public Component ──

interface NodeIconProps extends LucideProps {
  /** Semantic icon name from the registry */
  name: string;
}

/**
 * Renders a Lucide icon by name. Falls back to Zap for unknown names.
 */
export const NodeIcon: FC<NodeIconProps> = memo(({ name, ...props }) => {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    // Unknown icon name — render fallback
    return <Zap {...props} />;
  }
  return <IconComponent {...props} />;
});

NodeIcon.displayName = 'NodeIcon';
