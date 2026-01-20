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

    // Set up periodic session refresh to prevent idle logout
    // Check every 10 minutes if token needs refreshing
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error("Error getting session:", error)
          return
        }

        if (session && session.expires_at) {
          // Calculate time until expiration (in seconds)
          const expiresAt = session.expires_at
          const now = Math.floor(Date.now() / 1000)
          const expiresIn = expiresAt - now

          // Refresh if less than 10 minutes remaining (tokens typically expire after 60 minutes)
          if (expiresIn < 600 && expiresIn > 0) {
            console.log(`Token expiring in ${Math.floor(expiresIn / 60)} minutes, refreshing...`)
            try {
              const { error: refreshError } = await supabase.auth.refreshSession()
              if (refreshError) {
                console.error("Error refreshing session:", refreshError)
                // If refresh fails, don't immediately logout - let Supabase handle it
              } else {
                console.log("Session refreshed successfully")
              }
            } catch (refreshError) {
              console.error("Exception refreshing session:", refreshError)
            }
          }
        }
      } catch (error) {
        console.error("Error in session check interval:", error)
      }
    }, 10 * 60 * 1000) // Check every 10 minutes

    // Refresh session on user activity to keep session alive
    let activityTimeout: NodeJS.Timeout
    let lastRefresh = 0
    
    const handleUserActivity = () => {
      // Throttle refreshes - only refresh once per minute max
      const now = Date.now()
      if (now - lastRefresh < 60000) {
        return
      }

      clearTimeout(activityTimeout)
      activityTimeout = setTimeout(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session && session.expires_at) {
            const expiresAt = session.expires_at
            const now = Math.floor(Date.now() / 1000)
            const expiresIn = expiresAt - now

            // Only refresh if less than 30 minutes remaining
            if (expiresIn < 1800 && expiresIn > 300) {
              await supabase.auth.refreshSession()
              lastRefresh = Date.now()
              console.log("Session refreshed on user activity")
            }
          }
        } catch (error) {
          // Silently handle - don't log every time user moves mouse
        }
      }, 30000) // Wait 30 seconds after last activity before refreshing
    }

    // Add event listeners for user activity (only on protected pages)
    if (typeof window !== "undefined" && !pathname?.startsWith("/auth/")) {
      window.addEventListener("mousemove", handleUserActivity, { passive: true })
      window.addEventListener("keydown", handleUserActivity, { passive: true })
      window.addEventListener("click", handleUserActivity, { passive: true })
      window.addEventListener("scroll", handleUserActivity, { passive: true })
    }

    // Cleanup
    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
      clearTimeout(activityTimeout)
      if (typeof window !== "undefined") {
        window.removeEventListener("mousemove", handleUserActivity)
        window.removeEventListener("keydown", handleUserActivity)
        window.removeEventListener("click", handleUserActivity)
        window.removeEventListener("scroll", handleUserActivity)
      }
    }
  }, [router, pathname])

  return <>{children}</>
}