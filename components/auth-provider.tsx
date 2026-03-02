"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id)

      // Handle different auth events
      switch (event) {
        case "SIGNED_OUT":
          // Only redirect if not already on login page and not on a public page
          if (!pathname?.startsWith("/auth/")) {
            console.log("User signed out, redirecting to login")
            router.push("/auth/login")
          }
          break

        case "TOKEN_REFRESHED":
          console.log("Token refreshed successfully")
          break

        case "SIGNED_IN":
          if (session) {
            console.log("User signed in:", session.user.id)
          }
          break

        case "USER_UPDATED":
          console.log("User updated")
          break

        default:
          // Ignore other events like PASSWORD_RECOVERY, etc.
          break
      }
    })

    // Cleanup
    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])


  return <>{children}</>
}