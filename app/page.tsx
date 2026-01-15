"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { School, DollarSign, Globe, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { generateVoucherCode } from "@/lib/utils"

type Application = {
  id: string
  student_name: string
  email: string
  phone: string | null
  school_name: string
  district: string | null
  grade_level: string | null
  program_type: string
  financial_need_description: string | null
  academic_goals: string | null
  student_count: number
  voucher_amount: number | null
  voucher_code: string | null
  country: string
  status: "pending" | "approved" | "rejected"
  applied_date: string
  reviewed_at: string | null
  notes: string | null
}

type Donation = {
  id: string
  donor_name: string
  donor_email: string
  amount: number
  donation_type: string
  payment_status: string
  created_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState({
    totalApplications: 0,
    pending: 0,
    approved: 0,
    totalVouchersIssued: 0,
    totalDonations: 0,
    totalDonationAmount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending")

  useEffect(() => {
    const isAuth = localStorage.getItem("adminAuth")
    if (!isAuth) {
      router.push("/auth")
      return
    }

    loadData()
  }, [router])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Load applications
      const { data: appsData, error: appsError } = await supabase
        .from("scholarship_applications")
        .select("*")
        .order("applied_date", { ascending: false })

      if (appsError) throw appsError

      // Load donations
      const { data: donationsData, error: donationsError } = await supabase
        .from("donations")
        .select("*")
        .order("created_at", { ascending: false })

      if (donationsError) throw donationsError

      const formattedApps = (appsData || []).map((app) => ({
        ...app,
        applied_date: new Date(app.applied_date).toISOString().split("T")[0],
      }))

      setApplications(formattedApps as Application[])
      setDonations((donationsData || []) as Donation[])
      calculateStats(formattedApps as Application[], donationsData || [])
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast.error("Failed to load data. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = (apps: Application[], donations: Donation[]) => {
    setStats({
      totalApplications: apps.length,
      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      totalVouchersIssued: apps
        .filter((a) => a.status === "approved")
        .reduce((sum, a) => sum + (a.voucher_amount || 0), 0),
      totalDonations: donations.length,
      totalDonationAmount: donations.reduce((sum, d) => sum + d.amount, 0),
    })
  }

  const handleStatusChange = async (id: string, newStatus: "approved" | "rejected") => {
    setIsUpdating(id)
    try {
      const application = applications.find((app) => app.id === id)
      if (!application) return

      // Generate unique voucher code if approving and has voucher amount
      let voucherCode: string | null = null
      if (newStatus === "approved" && application.voucher_amount) {
        // Generate unique voucher code, retry if duplicate
        let attempts = 0
        const maxAttempts = 10
        while (attempts < maxAttempts) {
          voucherCode = generateVoucherCode()
          // Check if code already exists
          const { data: existing } = await supabase
            .from("scholarship_applications")
            .select("id")
            .eq("voucher_code", voucherCode)
            .single()
          
          if (!existing) break // Code is unique
          attempts++
        }
        
        if (attempts >= maxAttempts) {
          throw new Error("Failed to generate unique voucher code. Please try again.")
        }
      }

      // Update in Supabase
      const updateData: any = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      }
      
      if (voucherCode) {
        updateData.voucher_code = voucherCode
      }

      const { error: updateError } = await supabase
        .from("scholarship_applications")
        .update(updateData)
        .eq("id", id)

      if (updateError) throw updateError

      // Send email notification
      try {
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: application.email,
            studentName: application.student_name,
            status: newStatus,
            schoolName: application.school_name,
            programType: application.program_type,
          }),
        })

        if (!response.ok) {
          console.error("Failed to send email notification")
        }
      } catch (emailError) {
        console.error("Email error:", emailError)
        // Don't fail the whole operation if email fails
      }

      // Reload data
      await loadData()
      toast.success(`Application ${newStatus} successfully!`)
    } catch (error: any) {
      console.error("Error updating application:", error)
      toast.error(error.message || "Failed to update application. Please try again.")
    } finally {
      setIsUpdating(null)
    }
  }


  const pendingApplications = applications.filter((a) => a.status === "pending")
  const approvedApplications = applications.filter((a) => a.status === "approved")
  const rejectedApplications = applications.filter((a) => a.status === "rejected")

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header userName="Admin User" role="admin" />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600">
              Overview of scholarship applications and donations
            </p>
          </div>
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Applications</h3>
                <School className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalApplications}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Pending Review</h3>
                <Globe className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Approved</h3>
                <CheckCircle className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.approved}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Vouchers Issued</h3>
                <DollarSign className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900">${stats.totalVouchersIssued.toLocaleString()}</div>
            </div>
          </div>

          {/* Donations Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Donations Overview</h2>
            <p className="text-sm text-gray-600 mb-4">Total donations received</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Donations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDonations}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalDonationAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Applications Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Scholarship Applications</h2>
          <p className="text-sm text-gray-600 mb-6">Review and manage scholarship applications</p>
          <div className="w-full">
            <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === "pending"
                      ? "border-b-2 border-indigo-500 text-indigo-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Pending ({pendingApplications.length})
                </button>
                <button
                  onClick={() => setActiveTab("approved")}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === "approved"
                      ? "border-b-2 border-indigo-500 text-indigo-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Approved ({approvedApplications.length})
                </button>
                <button
                  onClick={() => setActiveTab("rejected")}
                  className={`px-4 py-2 font-medium text-sm ${
                    activeTab === "rejected"
                      ? "border-b-2 border-indigo-500 text-indigo-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Rejected ({rejectedApplications.length})
                </button>
              </div>

              <div className="space-y-4">
                {activeTab === "pending" && (
                  pendingApplications.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No pending applications</p>
                  ) : (
                    pendingApplications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        onStatusChange={handleStatusChange}
                        isUpdating={isUpdating === app.id}
                      />
                    ))
                  )
                )}

                {activeTab === "approved" && (
                  approvedApplications.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No approved applications</p>
                  ) : (
                    approvedApplications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        onStatusChange={handleStatusChange}
                        isUpdating={isUpdating === app.id}
                      />
                    ))
                  )
                )}

                {activeTab === "rejected" && (
                  rejectedApplications.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No rejected applications</p>
                  ) : (
                    rejectedApplications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        onStatusChange={handleStatusChange}
                        isUpdating={isUpdating === app.id}
                      />
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function ApplicationCard({
  application,
  onStatusChange,
  isUpdating,
}: {
  application: Application
  onStatusChange: (id: string, status: "approved" | "rejected") => void
  isUpdating: boolean
}) {
  const getStatusBadgeColor = () => {
    if (application.status === "approved") {
      return "bg-green-100 text-green-800"
    } else if (application.status === "rejected") {
      return "bg-red-100 text-red-800"
    }
    return "bg-yellow-100 text-yellow-800"
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{application.student_name}</h3>
            <p className="text-sm text-gray-600">{application.school_name}</p>
            {application.district && <p className="text-xs text-gray-500">{application.district}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{application.email}</p>
            </div>
            {application.phone && (
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium text-gray-900">{application.phone}</p>
              </div>
            )}
            <div>
              <p className="text-gray-600">Applied Date</p>
              <p className="font-medium text-gray-900">{new Date(application.applied_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-600">Program Type</p>
              <p className="font-medium text-gray-900">{application.program_type}</p>
            </div>
            {application.grade_level && (
              <div>
                <p className="text-gray-600">Grade Level</p>
                <p className="font-medium text-gray-900">{application.grade_level}</p>
              </div>
            )}
            <div>
              <p className="text-gray-600">Students</p>
              <p className="font-medium text-gray-900">{application.student_count} student(s)</p>
            </div>
            {application.voucher_amount && (
              <div>
                <p className="text-gray-600">Voucher Amount</p>
                <p className="font-medium text-indigo-600">${application.voucher_amount}</p>
              </div>
            )}
            <div>
              <p className="text-gray-600">Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor()}`}>
                {application.status}
              </span>
            </div>
          </div>

          {application.financial_need_description && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">Financial Need:</p>
              <p className="text-sm text-gray-600">{application.financial_need_description}</p>
            </div>
          )}

          {application.academic_goals && (
            <div className="mt-2">
              <p className="text-sm font-semibold text-gray-900 mb-2">Academic Goals:</p>
              <p className="text-sm text-gray-600">{application.academic_goals}</p>
            </div>
          )}
        </div>
      </div>

      {application.status === "pending" && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => onStatusChange(application.id, "approved")}
            disabled={isUpdating}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#e01414] via-[#760da3] to-[#008cff] hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Approve Application
              </>
            )}
          </button>
          <button
            onClick={() => onStatusChange(application.id, "rejected")}
            disabled={isUpdating}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Reject Application
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
