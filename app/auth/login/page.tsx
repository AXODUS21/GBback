"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, Loader2, School } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Check user role
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, id")
        .eq("id", data.user.id)
        .single()

      if (profileError) throw profileError

      // Check if school is approved
      if (profile.role === "school") {
        const { data: schoolProfile } = await supabase
          .from("school_profiles")
          .select("id")
          .eq("id", data.user.id)
          .single()

        if (!schoolProfile) {
          await supabase.auth.signOut()
          throw new Error("Your school account is pending approval. Please wait for admin approval.")
        }
      }

      // Check if vendor is approved
      if (profile.role === "vendor") {
        const { data: vendorProfile } = await supabase
          .from("vendor_profiles")
          .select("id, status")
          .eq("id", data.user.id)
          .single()

        if (!vendorProfile) {
          await supabase.auth.signOut()
          throw new Error("Your vendor account is pending approval. Please wait for admin approval.")
        }

        if (vendorProfile.status === "suspended") {
          await supabase.auth.signOut()
          throw new Error("Your vendor account has been suspended. Please contact support.")
        }
      }

      toast.success("Login successful!")
      
      // Redirect based on role
      if (profile.role === "admin") {
        router.push("/")
      } else if (profile.role === "school") {
        router.push("/apply")
      } else if (profile.role === "vendor") {
        // Vendors can access their vendor dashboard (you can create this later)
        router.push("/vendor")
      } else {
        router.push("/")
      }
    } catch (error: any) {
      console.error("Login error:", error)
      setError(error.message || "Invalid email or password")
      toast.error(error.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <School className="h-12 w-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#e01414] via-[#760da3] to-[#008cff] hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Sign up as a school
            </Link>
            {" or "}
            <Link href="/auth/vendor-signup" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Sign up as a vendor
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
