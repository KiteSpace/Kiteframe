import { memo } from "react";
import { Table, Image, FileText, Layers, Globe, LucideIcon } from "lucide-react";

interface DragPlaceholderProps {
  nodeType: "table" | "image" | "form" | "compound" | "webview";
  width: number;
  height: number;
  label?: string;
  selected?: boolean;
  favicon?: string;
}

const nodeTypeConfig: Record<string, { Icon: LucideIcon; color: string; bgColor: string }> = {
  table: { 
    Icon: Table, 
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.08)"
  },
  image: { 
    Icon: Image, 
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.08)"
  },
  form: { 
    Icon: FileText, 
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.08)"
  },
  compound: { 
    Icon: Layers, 
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.08)"
  },
  webview: { 
    Icon: Globe, 
    color: "#06b6d4",
    bgColor: "rgba(6, 182, 212, 0.08)"
  },
};

const DragPlaceholder = memo(function DragPlaceholder({
  nodeType,
  width,
  height,
  label,
  selected,
  favicon,
}: DragPlaceholderProps) {
  const config = nodeTypeConfig[nodeType] || nodeTypeConfig.table;
  const { Icon } = config;
  const iconSize = Math.min(32, height * 0.3);
  
  return (
    <div
      style={{
        width,
        height,
        minWidth: 120,
        minHeight: 60,
        backgroundColor: config.bgColor,
        border: `2px dashed ${config.color}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: 0.9,
        boxShadow: selected 
          ? `0 0 0 2px ${config.color}, 0 4px 12px rgba(0,0,0,0.15)` 
          : "0 4px 12px rgba(0,0,0,0.15)",
        pointerEvents: "none",
        userSelect: "none",
      }}
      data-testid={`drag-placeholder-${nodeType}`}
    >
      {nodeType === 'webview' && favicon ? (
        <img 
          src={favicon} 
          alt="" 
          style={{ 
            width: iconSize, 
            height: iconSize, 
            objectFit: 'contain',
            opacity: 0.7 
          }} 
        />
      ) : (
        <Icon 
          size={iconSize} 
          color={config.color}
          style={{ opacity: 0.7 }}
        />
      )}
      {label && height > 80 && (
        <span
          style={{
            fontSize: 12,
            color: config.color,
            fontWeight: 500,
            maxWidth: width - 20,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
});

export default DragPlaceholder;
