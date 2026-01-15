"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { Loader2, CheckCircle, XCircle, School, Mail, Phone, MapPin } from "lucide-react"

type SchoolSignup = {
  id: string
  email: string
  school_name: string
  contact_name: string
  contact_phone: string | null
  school_address: string | null
  school_district: string | null
  school_type: string | null
  student_count: number | null
  website: string | null
  additional_info: string | null
  status: "pending" | "approved" | "rejected"
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
}

export default function SchoolSignupsPage() {
  const router = useRouter()
  const [signups, setSignups] = useState<SchoolSignup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    loadSignups()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
      return
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      router.push("/auth/login")
      return
    }
  }

  const loadSignups = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("school_signups")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setSignups(data || [])
    } catch (error: any) {
      console.error("Error loading signups:", error)
      toast.error("Failed to load school signups")
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproval = async (signupId: string, status: "approved" | "rejected", notes?: string) => {
    setIsUpdating(signupId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const signup = signups.find(s => s.id === signupId)
      if (!signup) throw new Error("Signup not found")

      // Update signup status
      const { error: updateError } = await supabase
        .from("school_signups")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq("id", signupId)

      if (updateError) throw updateError

      if (status === "approved") {
        // Get the auth user ID from email
        const { data: authUser } = await supabase.auth.admin.listUsers()
        const userToApprove = authUser?.users.find(u => u.email === signup.email)

        if (userToApprove) {
          // Create school profile
          const { error: profileError } = await supabase
            .from("school_profiles")
            .insert([
              {
                id: userToApprove.id,
                school_name: signup.school_name,
                contact_name: signup.contact_name,
                contact_phone: signup.contact_phone,
                school_address: signup.school_address,
                school_district: signup.school_district,
                school_type: signup.school_type,
                student_count: signup.student_count,
                website: signup.website,
              },
            ])

          if (profileError) throw profileError
        }
      }

      toast.success(`School signup ${status} successfully!`)
      await loadSignups()
    } catch (error: any) {
      console.error("Error updating signup:", error)
      toast.error(error.message || "Failed to update signup")
    } finally {
      setIsUpdating(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const pendingSignups = signups.filter(s => s.status === "pending")
  const approvedSignups = signups.filter(s => s.status === "approved")
  const rejectedSignups = signups.filter(s => s.status === "rejected")

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header userName="Admin User" role="admin" />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              School Signup Approvals
            </h1>
            <p className="text-gray-600">Review and approve school registration requests</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-2xl font-bold text-gray-900">{pendingSignups.length}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-2xl font-bold text-green-600">{approvedSignups.length}</div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-2xl font-bold text-red-600">{rejectedSignups.length}</div>
              <div className="text-sm text-gray-600">Rejected</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Pending Approvals</h2>
            {pendingSignups.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No pending signups</p>
            ) : (
              <div className="space-y-6">
                {pendingSignups.map((signup) => (
                  <div key={signup.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <School className="h-5 w-5 text-indigo-600" />
                          {signup.school_name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{signup.email}</p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Pending
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Contact Name</p>
                        <p className="font-medium text-gray-900">{signup.contact_name}</p>
                      </div>
                      {signup.contact_phone && (
                        <div>
                          <p className="text-gray-600">Contact Phone</p>
                          <p className="font-medium text-gray-900">{signup.contact_phone}</p>
                        </div>
                      )}
                      {signup.school_address && (
                        <div>
                          <p className="text-gray-600">Address</p>
                          <p className="font-medium text-gray-900">{signup.school_address}</p>
                        </div>
                      )}
                      {signup.school_district && (
                        <div>
                          <p className="text-gray-600">District</p>
                          <p className="font-medium text-gray-900">{signup.school_district}</p>
                        </div>
                      )}
                      {signup.school_type && (
                        <div>
                          <p className="text-gray-600">School Type</p>
                          <p className="font-medium text-gray-900">{signup.school_type}</p>
                        </div>
                      )}
                      {signup.student_count && (
                        <div>
                          <p className="text-gray-600">Student Count</p>
                          <p className="font-medium text-gray-900">{signup.student_count}</p>
                        </div>
                      )}
                      {signup.website && (
                        <div>
                          <p className="text-gray-600">Website</p>
                          <a href={signup.website} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline">
                            {signup.website}
                          </a>
                        </div>
                      )}
                    </div>

                    {signup.additional_info && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 mb-2">Additional Information</p>
                        <p className="text-sm text-gray-600">{signup.additional_info}</p>
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => handleApproval(signup.id, "approved")}
                        disabled={isUpdating === signup.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating === signup.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt("Enter rejection reason (optional):")
                          if (notes !== null) {
                            handleApproval(signup.id, "rejected", notes)
                          }
                        }}
                        disabled={isUpdating === signup.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating === signup.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Reject
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
