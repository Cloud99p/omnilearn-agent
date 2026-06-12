/**
 * RequireAuth - Protect pages that need authenticated users
 * 
 * Usage:
 * ```tsx
 * export default function IntelligencePage() {
 *   return (
 *     <RequireAuth>
 *       <IntelligenceContent />
 *     </RequireAuth>
 *   );
 * }
 * ```
 */

import { useUser, SignInButton } from "@clerk/react";
import { motion } from "framer-motion";
import { LogIn, Shield, ArrowRight } from "lucide-react";

interface RequireAuthProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function RequireAuth({ children, redirectTo = "/sign-in" }: RequireAuthProps) {
  const { isLoaded, isSignedIn } = useUser();

  // Still loading auth state
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // User is signed in - render protected content
  if (isSignedIn) {
    return <>{children}</>;
  }

  // User is NOT signed in - show registration prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Authentication Required</h1>
            </div>
            <p className="text-muted-foreground">
              This page contains personal data and requires an account to access.
            </p>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className="space-y-6">
              {/* Benefits */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Why sign in?
                </h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="p-1 bg-green-500/10 rounded-full mt-0.5">
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-foreground">
                      <strong>Persistent memory</strong> - Your knowledge graph grows with you
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 bg-green-500/10 rounded-full mt-0.5">
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-foreground">
                      <strong>Character evolution</strong> - Track your AI's personality development
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 bg-green-500/10 rounded-full mt-0.5">
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-foreground">
                      <strong>Conversation history</strong> - Never lose important discussions
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 bg-green-500/10 rounded-full mt-0.5">
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-foreground">
                      <strong>Network insights</strong> - Access advanced analytics and metrics
                    </span>
                  </li>
                </ul>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3 pt-4">
                <SignInButton mode="modal">
                  <button className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl">
                    <LogIn className="h-5 w-5" />
                    Sign In or Create Account
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </SignInButton>
                
                <p className="text-xs text-center text-muted-foreground">
                  Free to use • No credit card required • Setup takes 30 seconds
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-muted/30 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <SignInButton mode="modal">
                <button className="text-primary hover:underline font-medium">
                  Sign in here
                </button>
              </SignInButton>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default RequireAuth;
