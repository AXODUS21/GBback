"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { Loader2, CheckCircle, XCircle, Ticket, DollarSign, School } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateVoucherCode } from "@/lib/utils"

type VoucherRequest = {
  id: string
  school_id: string
  requested_amount: number
  purpose: string | null
  student_count: number | null
  status: "pending" | "approved" | "rejected"
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  school_name?: string
  school_email?: string
}

export default function VoucherRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<VoucherRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  useEffect(() => {
    checkAuth()
    loadRequests()
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
      .maybeSingle()

    if (!profile || profile.role !== "admin") {
      router.push("/auth/login")
      return
    }
  }

  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("voucher_requests")
        .select("*")
        .order("requested_at", { ascending: false })

      if (error) throw error

      // Load school information for each request
      const requestsWithSchoolInfo = await Promise.all(
        (data || []).map(async (request: any) => {
          const { data: schoolData } = await supabase
            .from("school_profiles")
            .select("school_name, contact_email")
            .eq("id", request.school_id)
            .maybeSingle()

          return {
            ...request,
            school_name: schoolData?.school_name || "Unknown School",
            school_email: schoolData?.contact_email || null,
          }
        })
      )

      setRequests(requestsWithSchoolInfo)
    } catch (error: any) {
      console.error("Error loading voucher requests:", error)
      toast.error("Failed to load voucher requests")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleStatusChange = async (
    requestId: string,
    newStatus: "approved" | "rejected",
    notes?: string
  ) => {
    setIsUpdating(requestId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const request = requests.find(r => r.id === requestId)
      if (!request) throw new Error("Request not found")

      // If approving, generate unique voucher code and create voucher
      if (newStatus === "approved") {
        // Generate unique voucher code
        let voucherCode: string | null = null
        let attempts = 0
        const maxAttempts = 10

        while (attempts < maxAttempts) {
          voucherCode = generateVoucherCode()
          const { data: existing } = await supabase
            .from("vouchers")
            .select("id")
            .eq("voucher_code", voucherCode)
            .maybeSingle()

          if (!existing) break // Code is unique
          attempts++
        }

        if (attempts >= maxAttempts || !voucherCode) {
          throw new Error("Failed to generate unique voucher code. Please try again.")
        }

        // Create voucher record
        const { error: voucherError } = await supabase
          .from("vouchers")
          .insert([
            {
              voucher_code: voucherCode,
              school_id: request.school_id,
              voucher_request_id: requestId,
              amount: request.requested_amount,
              purpose: request.purpose,
              status: "active",
              created_by: user.id,
            },
          ])

        if (voucherError) throw voucherError

        // Send email notification to school
        if (request.school_email) {
          try {
            const response = await fetch("/api/send-email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: request.school_email,
                type: "voucher_approved",
                voucherCode,
                amount: request.requested_amount,
                schoolName: request.school_name,
              }),
            })

            if (!response.ok) {
              console.error("Failed to send email notification")
            }
          } catch (emailError) {
            console.error("Email error:", emailError)
            // Don't fail the whole operation if email fails
          }
        }
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("voucher_requests")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq("id", requestId)

      if (updateError) throw updateError

      toast.success(`Voucher request ${newStatus} successfully!`)
      await loadRequests()
    } catch (error: any) {
      console.error("Error updating request:", error)
      toast.error(error.message || "Failed to update request")
    } finally {
      setIsUpdating(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="lg:pl-64">
          <Header userName="Admin User" role="admin" />
          <main className="p-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  const filteredRequests = selectedStatus === "all"
    ? requests
    : requests.filter(r => r.status === selectedStatus)

  const pendingRequests = requests.filter(r => r.status === "pending")
  const approvedRequests = requests.filter(r => r.status === "approved")
  const rejectedRequests = requests.filter(r => r.status === "rejected")

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header userName="Admin User" role="admin" />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Voucher Requests
            </h1>
            <p className="text-gray-600">Review and approve school voucher requests</p>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-gray-900">{requests.length}</div>
                <div className="text-sm text-gray-600">Total Requests</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{approvedRequests.length}</div>
                <div className="text-sm text-gray-600">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{rejectedRequests.length}</div>
                <div className="text-sm text-gray-600">Rejected</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="mb-6">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            >
              <option value="all">All Requests</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No voucher requests found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <School className="h-5 w-5 text-indigo-600" />
                          <span className="font-semibold text-lg">{request.school_name}</span>
                          <DollarSign className="h-5 w-5 text-green-600" />
                          <span className="font-bold text-xl text-green-600">
                            ${request.requested_amount}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                          {request.purpose && (
                            <div>
                              <p className="text-gray-600">Purpose</p>
                              <p className="font-medium text-gray-900">{request.purpose}</p>
                            </div>
                          )}
                          {request.student_count && (
                            <div>
                              <p className="text-gray-600">Students</p>
                              <p className="font-medium text-gray-900">{request.student_count}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-600">Requested</p>
                            <p className="font-medium text-gray-900">
                              {new Date(request.requested_at).toLocaleString()}
                            </p>
                          </div>
                          {request.school_email && (
                            <div>
                              <p className="text-gray-600">Email</p>
                              <p className="font-medium text-gray-900">{request.school_email}</p>
                            </div>
                          )}
                        </div>
                        {request.review_notes && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Review Notes:</span> {request.review_notes}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {request.status === "pending" && (
                          <>
                            <button
                              onClick={() => {
                                const notes = prompt("Enter approval notes (optional):")
                                if (notes !== null) {
                                  handleStatusChange(request.id, "approved", notes)
                                }
                              }}
                              disabled={isUpdating === request.id}
                              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdating === request.id ? (
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
                                  handleStatusChange(request.id, "rejected", notes)
                                }
                              }}
                              disabled={isUpdating === request.id}
                              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdating === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </>
                              )}
                            </button>
                          </>
                        )}
                        {request.status === "approved" && (
                          <span className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Approved
                          </span>
                        )}
                        {request.status === "rejected" && (
                          <span className="px-3 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
