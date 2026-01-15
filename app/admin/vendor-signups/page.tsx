"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { Loader2, CheckCircle, XCircle, Building2, Mail, Phone, MapPin, AlertTriangle } from "lucide-react"

type VendorSignup = {
  id: string
  email: string
  vendor_name: string
  vendor_type: string
  country: string
  contact_name: string
  contact_phone: string | null
  status: "submitted" | "under_review" | "approved" | "active" | "suspended"
  risk_flag: boolean
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
}

export default function VendorSignupsPage() {
  const router = useRouter()
  const [signups, setSignups] = useState<VendorSignup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

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
        .from("vendor_signups")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setSignups(data || [])
    } catch (error: any) {
      console.error("Error loading signups:", error)
      toast.error("Failed to load vendor signups")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (
    signupId: string,
    newStatus: "under_review" | "approved" | "suspended",
    riskFlag?: boolean,
    notes?: string
  ) => {
    setIsUpdating(signupId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const signup = signups.find(s => s.id === signupId)
      if (!signup) throw new Error("Signup not found")

      // Update signup status
      const updateData: any = {
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      }

      if (riskFlag !== undefined) {
        updateData.risk_flag = riskFlag
      }

      const { error: updateError } = await supabase
        .from("vendor_signups")
        .update(updateData)
        .eq("id", signupId)

      if (updateError) throw updateError

      if (newStatus === "approved" || newStatus === "active") {
        // Get the auth user ID from email
        const { data: authUser } = await supabase.auth.admin.listUsers()
        const userToApprove = authUser?.users.find(u => u.email === signup.email)

        if (userToApprove) {
          // Check if profile already exists
          const { data: existing } = await supabase
            .from("vendor_profiles")
            .select("id")
            .eq("id", userToApprove.id)
            .single()

          if (!existing) {
            // Create vendor profile
            const { error: profileError } = await supabase
              .from("vendor_profiles")
              .insert([
                {
                  id: userToApprove.id,
                  vendor_name: signup.vendor_name,
                  vendor_type: signup.vendor_type,
                  country: signup.country,
                  contact_name: signup.contact_name,
                  contact_phone: signup.contact_phone,
                  status: newStatus === "approved" ? "active" : newStatus,
                  risk_flag: riskFlag !== undefined ? riskFlag : signup.risk_flag,
                  notes: notes || signup.notes,
                },
              ])

            if (profileError) throw profileError
          } else {
            // Update existing profile
            const { error: profileError } = await supabase
              .from("vendor_profiles")
              .update({
                vendor_name: signup.vendor_name,
                vendor_type: signup.vendor_type,
                country: signup.country,
                contact_name: signup.contact_name,
                contact_phone: signup.contact_phone,
                status: newStatus === "approved" ? "active" : newStatus,
                risk_flag: riskFlag !== undefined ? riskFlag : signup.risk_flag,
                notes: notes || signup.notes,
              })
              .eq("id", userToApprove.id)

            if (profileError) throw profileError
          }
        }
      }

      toast.success(`Vendor signup ${newStatus} successfully!`)
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

  const filteredSignups = selectedStatus === "all" 
    ? signups 
    : signups.filter(s => s.status === selectedStatus)

  const statusCounts = {
    all: signups.length,
    submitted: signups.filter(s => s.status === "submitted").length,
    under_review: signups.filter(s => s.status === "under_review").length,
    approved: signups.filter(s => s.status === "approved").length,
    active: signups.filter(s => s.status === "active").length,
    suspended: signups.filter(s => s.status === "suspended").length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-gray-100 text-gray-800"
      case "under_review":
        return "bg-yellow-100 text-yellow-800"
      case "approved":
      case "active":
        return "bg-green-100 text-green-800"
      case "suspended":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header userName="Admin User" role="admin" />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Vendor Signup Approvals
            </h1>
            <p className="text-gray-600">Review and approve vendor registration requests</p>
          </div>

          <div className="grid gap-4 md:grid-cols-6 mb-8">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer transition ${
                  selectedStatus === status
                    ? "border-indigo-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`text-2xl font-bold ${selectedStatus === status ? "text-indigo-600" : "text-gray-900"}`}>
                  {count}
                </div>
                <div className="text-sm text-gray-600 capitalize">
                  {status.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {selectedStatus === "all" ? "All Signups" : `${selectedStatus.replace("_", " ").toUpperCase()} Signups`}
            </h2>
            {filteredSignups.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No vendor signups found</p>
            ) : (
              <div className="space-y-6">
                {filteredSignups.map((signup) => (
                  <div key={signup.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-indigo-600" />
                          {signup.vendor_name}
                          {signup.risk_flag && (
                            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                              <AlertTriangle className="h-3 w-3" />
                              Risk Flag
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{signup.email}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(signup.status)}`}>
                        {signup.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-600">Vendor Type</p>
                        <p className="font-medium text-gray-900">{signup.vendor_type}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Country</p>
                        <p className="font-medium text-gray-900 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {signup.country}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Contact Name</p>
                        <p className="font-medium text-gray-900">{signup.contact_name}</p>
                      </div>
                      {signup.contact_phone && (
                        <div>
                          <p className="text-gray-600">Contact Phone</p>
                          <p className="font-medium text-gray-900 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {signup.contact_phone}
                          </p>
                        </div>
                      )}
                      {signup.notes && (
                        <div className="md:col-span-3">
                          <p className="text-gray-600">Notes</p>
                          <p className="font-medium text-gray-900">{signup.notes}</p>
                        </div>
                      )}
                      {signup.review_notes && (
                        <div className="md:col-span-3">
                          <p className="text-gray-600">Review Notes</p>
                          <p className="font-medium text-gray-900">{signup.review_notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex gap-3 flex-wrap">
                      {signup.status === "submitted" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(signup.id, "under_review")}
                            disabled={isUpdating === signup.id}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isUpdating === signup.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Mark Under Review"
                            )}
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt("Enter approval notes (optional):")
                              handleStatusChange(signup.id, "approved", false, notes || undefined)
                            }}
                            disabled={isUpdating === signup.id}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                              const riskFlag = confirm("Mark this vendor as a risk flag?")
                              const notes = prompt("Enter rejection/review notes (optional):")
                              handleStatusChange(signup.id, "suspended", riskFlag, notes || undefined)
                            }}
                            disabled={isUpdating === signup.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isUpdating === signup.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                Suspend
                              </>
                            )}
                          </button>
                        </>
                      )}
                      {signup.status === "under_review" && (
                        <>
                          <button
                            onClick={() => {
                              const notes = prompt("Enter approval notes (optional):")
                              handleStatusChange(signup.id, "approved", false, notes || undefined)
                            }}
                            disabled={isUpdating === signup.id}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                              const riskFlag = confirm("Mark this vendor as a risk flag?")
                              const notes = prompt("Enter notes (optional):")
                              handleStatusChange(signup.id, "suspended", riskFlag, notes || undefined)
                            }}
                            disabled={isUpdating === signup.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isUpdating === signup.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                Suspend
                              </>
                            )}
                          </button>
                        </>
                      )}
                      {(signup.status === "approved" || signup.status === "active") && (
                        <button
                          onClick={() => {
                            const notes = prompt("Enter suspension reason (optional):")
                            handleStatusChange(signup.id, "suspended", signup.risk_flag, notes || undefined)
                          }}
                          disabled={isUpdating === signup.id}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isUpdating === signup.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              Suspend
                            </>
                          )}
                        </button>
                      )}
                      {signup.status === "suspended" && (
                        <button
                          onClick={() => {
                            const notes = prompt("Enter reactivation notes (optional):")
                            handleStatusChange(signup.id, "active", false, notes || undefined)
                          }}
                          disabled={isUpdating === signup.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isUpdating === signup.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Reactivate
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const currentRiskFlag = signup.risk_flag
                          const newRiskFlag = !currentRiskFlag
                          handleStatusChange(signup.id, signup.status, newRiskFlag, signup.notes || undefined)
                        }}
                        disabled={isUpdating === signup.id}
                        className={`px-4 py-2 font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                          signup.risk_flag
                            ? "bg-gray-600 hover:bg-gray-700 text-white"
                            : "bg-orange-600 hover:bg-orange-700 text-white"
                        }`}
                      >
                        {signup.risk_flag ? "Remove Risk Flag" : "Add Risk Flag"}
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
