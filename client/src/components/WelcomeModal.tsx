import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  isNewUser?: boolean;
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (user?.isNewUser) {
      setOpen(true);
    }
  }, [user?.isNewUser]);

  if (!open) return null;

  const firstName = user?.firstName;
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome to Kiteframe!";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl">{greeting}</DialogTitle>
          </div>
          <DialogDescription className="text-base text-foreground/80 pt-1">
            Your account has been created. You're all set to start building with
            Kiteframe — AI-powered visual workflows, PRD generation, and
            real-time collaboration, all in one place.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-2">
          <Button onClick={() => setOpen(false)}>
            Get started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
