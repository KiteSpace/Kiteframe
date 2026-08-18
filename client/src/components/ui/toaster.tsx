import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Zap,
  FileText,
  Download,
  Upload,
  Copy,
  Trash2,
  Lock,
  Sparkles,
} from "lucide-react"
import type { ReactNode } from "react"

function inferIcon(
  variant: string | undefined,
  title: ReactNode,
  explicitIcon: ReactNode | undefined,
  explicitIconClassName: string | undefined
): { icon: ReactNode; iconClassName: string } {
  if (explicitIcon !== undefined) {
    return { icon: explicitIcon, iconClassName: explicitIconClassName ?? "bg-violet-50" }
  }

  const t = typeof title === "string" ? title.toLowerCase() : ""

  if (variant === "destructive") {
    return {
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      iconClassName: "bg-red-50",
    }
  }

  if (/\b(error|failed|fail|invalid|denied|forbidden|unauthorized)\b/.test(t)) {
    return {
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      iconClassName: "bg-red-50",
    }
  }

  if (/\b(deleted|removed|revoked|rejected|cleared)\b/.test(t)) {
    return {
      icon: <Trash2 className="w-4 h-4 text-red-400" />,
      iconClassName: "bg-red-50",
    }
  }

  if (/\b(warning|caution|limit|quota)\b/.test(t)) {
    return {
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      iconClassName: "bg-amber-50",
    }
  }

  if (/\b(prd|document|spec)\b/.test(t)) {
    return {
      icon: <FileText className="w-4 h-4 text-violet-600" />,
      iconClassName: "bg-violet-50",
    }
  }

  if (/\b(ai|generat|workflow|kiteai|experiment|insight|analysis|analyzing)\b/.test(t)) {
    return {
      icon: <Zap className="w-4 h-4 text-violet-600" />,
      iconClassName: "bg-violet-50",
    }
  }

  if (/\b(export|download)\b/.test(t)) {
    return {
      icon: <Download className="w-4 h-4 text-blue-500" />,
      iconClassName: "bg-blue-50",
    }
  }

  if (/\b(import|upload|imported)\b/.test(t)) {
    return {
      icon: <Upload className="w-4 h-4 text-blue-500" />,
      iconClassName: "bg-blue-50",
    }
  }

  if (/\b(copied|copy|link)\b/.test(t)) {
    return {
      icon: <Copy className="w-4 h-4 text-gray-500" />,
      iconClassName: "bg-gray-100",
    }
  }

  if (/\b(access|granted|approved|accepted|unlocked|beta|auth)\b/.test(t)) {
    return {
      icon: <Lock className="w-4 h-4 text-emerald-600" />,
      iconClassName: "bg-emerald-50",
    }
  }

  if (/\b(success|saved|created|updated|applied|done|complete|added|sent|restored|reset|synced|connected|subscribed|promo|code)\b/.test(t)) {
    return {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      iconClassName: "bg-emerald-50",
    }
  }

  if (/\b(new|feature|tip|hint|note)\b/.test(t)) {
    return {
      icon: <Sparkles className="w-4 h-4 text-violet-500" />,
      iconClassName: "bg-violet-50",
    }
  }

  return {
    icon: <Info className="w-4 h-4 text-blue-500" />,
    iconClassName: "bg-blue-50",
  }
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, icon, iconClassName, variant, ...props }) {
        const derived = inferIcon(variant, title, icon, iconClassName)
        return (
          <Toast key={id} variant={variant} {...props}>
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                derived.iconClassName
              )}
            >
              {derived.icon}
            </div>
            <div className="flex-1 min-w-0 grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
