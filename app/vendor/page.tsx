"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { Ticket, CheckCircle, XCircle, Loader2, Package, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type VendorVoucherSubmission = {
  id: string
  vendor_id: string
  voucher_code: string
  voucher_application_id: string | null
  status: "pending" | "approved" | "rejected"
  verification_status: "valid" | "invalid" | "not_found"
  submitted_at: string
  reviewed_at: string | null
  review_notes: string | null
}

export default function VendorDashboard() {
  const router = useRouter()
  const [voucherCode, setVoucherCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [submissions, setSubmissions] = useState<VendorVoucherSubmission[]>([])
  const [vendorProfile, setVendorProfile] = useState<any>(null)

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
    try {
      setIsLoading(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push("/auth/login")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError || !profile || profile?.role !== "vendor") {
        toast.error("Access Denied: You must be a vendor to view this page.")
        router.push("/auth/login")
        return
      }

      // Load vendor profile (may not exist if not approved yet)
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendor_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      // If profile doesn't exist or error (not found), user is pending approval
      if (vendorError || !vendorData) {
        // Check signup status
        const { data: signupData } = await supabase
          .from("vendor_signups")
          .select("vendor_name, status")
          .eq("user_id", user.id)
          .maybeSingle()

        if (signupData) {
          setVendorProfile({
            vendor_name: signupData.vendor_name,
            status: signupData.status,
            isPending: true,
          })
        } else {
          setVendorProfile({
            vendor_name: "Vendor",
            status: "pending",
            isPending: true,
          })
        }
        setIsLoading(false)
        return
      }

      setVendorProfile(vendorData)
      await loadSubmissions(user.id)
    } catch (error: any) {
      console.error("Error checking auth:", error)
      toast.error("Failed to load dashboard")
      router.push("/auth/login")
    } finally {
      setIsLoading(false)
    }
  }

  const loadSubmissions = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from("vendor_voucher_submissions")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("submitted_at", { ascending: false })

      if (error) throw error
      setSubmissions(data || [])
    } catch (error: any) {
      console.error("Error loading submissions:", error)
      toast.error("Failed to load voucher submissions")
    }
  }

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voucherCode.trim()) {
      toast.error("Please enter a voucher code")
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Normalize voucher code (uppercase, trim whitespace)
      const normalizedCode = voucherCode.trim().toUpperCase()
      console.log("Verifying voucher code:", normalizedCode)

      // Verify voucher code exists - check scholarship_applications first (vendors have RLS access here)
      let verificationStatus: "valid" | "invalid" | "not_found" = "not_found"
      let voucherApplicationId: string | null = null

      // Check scholarship_applications first (this is where voucher codes are stored when approved)
      const { data: scholarshipApps, error: scholarshipError } = await supabase
        .from("scholarship_applications")
        .select("id, voucher_code, student_name, school_name, voucher_amount, status")
        .eq("voucher_code", normalizedCode)

      console.log("Scholarship application check:", { 
        scholarshipApps, 
        scholarshipError, 
        count: scholarshipApps?.length,
        codes: scholarshipApps?.map(a => ({ code: a.voucher_code, status: a.status }))
      })

      // Find approved application
      const approvedApp = scholarshipApps?.find(app => app.status === "approved") || null
      
      if (approvedApp) {
        console.log("Found approved scholarship application:", approvedApp)
        verificationStatus = "valid"
        voucherApplicationId = approvedApp.id
      } else if (scholarshipApps && scholarshipApps.length > 0) {
        // Found but not approved
        const app = scholarshipApps[0]
        verificationStatus = "invalid"
        console.log("Found application but not approved:", app.status)
        toast.error(`This voucher code is not approved yet (status: ${app.status})`)
      } else if (scholarshipError) {
        console.error("Error querying scholarship_applications:", scholarshipError)
        toast.error("Error verifying voucher code. Please try again.")
      } else {
        // Not found in scholarship_applications - try vouchers table as fallback
        console.log("Not found in scholarship_applications, trying vouchers table...")
        const { data: voucherRecords, error: voucherError } = await supabase
          .from("vouchers")
          .select("id, voucher_code, school_id, amount, purpose, status")
          .eq("voucher_code", normalizedCode)

        console.log("Voucher record check:", { 
          voucherRecords, 
          voucherError, 
          count: voucherRecords?.length
        })

        if (!voucherError && voucherRecords && voucherRecords.length > 0) {
          const voucherRecord = voucherRecords[0]
          if (voucherRecord.status === "active") {
            verificationStatus = "valid"
            // Try to find the corresponding scholarship application
            const { data: relatedApp } = await supabase
              .from("scholarship_applications")
              .select("id")
              .eq("voucher_code", normalizedCode)
              .eq("status", "approved")
              .maybeSingle()
            
            voucherApplicationId = relatedApp?.id || voucherRecord.id
            console.log("Found active voucher in vouchers table:", voucherRecord)
          } else {
            verificationStatus = "invalid"
            toast.error(`This voucher code is not active (status: ${voucherRecord.status})`)
          }
        } else {
          // Not found in either table
          verificationStatus = "not_found"
          console.error("Voucher code not found in either table:", normalizedCode)
          if (voucherError) {
            console.error("Voucher table error:", voucherError)
          }
          toast.error("Voucher code not found in database. Please verify the code and try again.")
        }
      }

      console.log("Final verification result:", { verificationStatus, voucherApplicationId })

      // Create submission (even if invalid, so admin can see attempts)
      const { error: insertError } = await supabase
        .from("vendor_voucher_submissions")
        .insert([
          {
            vendor_id: user.id,
            voucher_code: normalizedCode,
            voucher_application_id: voucherApplicationId,
            status: verificationStatus === "valid" ? "pending" : "rejected",
            verification_status: verificationStatus,
          },
        ])

      if (insertError) throw insertError

      if (verificationStatus === "valid") {
        toast.success("Voucher code verified! Submission sent to admin for approval.")
      } else {
        toast.error("Voucher code verification failed. Submission rejected.")
      }

      setVoucherCode("")
      await loadSubmissions(user.id)
    } catch (error: any) {
      console.error("Error submitting voucher:", error)
      toast.error(error.message || "Failed to submit voucher code")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="lg:pl-64">
          <Header userName="Vendor" role="vendor" />
          <main className="p-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Show pending approval message if not approved
  if (vendorProfile?.isPending) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="lg:pl-64">
          <Header userName={vendorProfile?.vendor_name || "Vendor"} role="vendor" />
          <main className="p-6">
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <div className="flex justify-center mb-4">
                      <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-yellow-600" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Account Under Evaluation
                    </h2>
                    <p className="text-gray-600 mb-4">
                      Your vendor account is currently pending admin approval. You will be able to access all features once your account has been reviewed and approved.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                      <p className="text-sm text-blue-800">
                        <strong>What happens next?</strong>
                      </p>
                      <ul className="text-sm text-blue-700 mt-2 space-y-1 text-left max-w-md mx-auto">
                        <li>• Our admin team will review your registration</li>
                        <li>• You'll receive access once approved</li>
                        <li>• Check back later or contact support if you have questions</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const pendingSubmissions = submissions.filter(s => s.status === "pending")
  const approvedSubmissions = submissions.filter(s => s.status === "approved")
  const rejectedSubmissions = submissions.filter(s => s.status === "rejected")

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header userName={vendorProfile?.vendor_name || "Vendor"} role="vendor" />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Vendor Dashboard
            </h1>
            <p className="text-gray-600">Submit and track voucher code redemptions</p>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{pendingSubmissions.length}</div>
                <div className="text-sm text-gray-600">Pending Approval</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{approvedSubmissions.length}</div>
                <div className="text-sm text-gray-600">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{rejectedSubmissions.length}</div>
                <div className="text-sm text-gray-600">Rejected</div>
              </CardContent>
            </Card>
          </div>

          {/* Voucher Code Submission Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-indigo-600" />
                Submit Voucher Code
              </CardTitle>
              <CardDescription>
                Enter a voucher code to verify and submit for admin approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitVoucher} className="space-y-4">
                <div>
                  <Label htmlFor="voucherCode">Voucher Code</Label>
                  <Input
                    id="voucherCode"
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="GBF-XXXX-XXXX"
                    className="mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting || !voucherCode.trim()}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Voucher Code
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Submissions List */}
          <Card>
            <CardHeader>
              <CardTitle>Voucher Code Submissions</CardTitle>
              <CardDescription>View all your voucher code submission history</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No voucher submissions yet</p>
                  <p className="text-sm text-gray-400 mt-2">Submit a voucher code above to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Ticket className="h-5 w-5 text-indigo-600" />
                            <span className="font-mono font-semibold text-lg">{submission.voucher_code}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>
                              Submitted: {new Date(submission.submitted_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {submission.verification_status === "valid" && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              Valid
                            </span>
                          )}
                          {submission.verification_status === "invalid" && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                              Invalid
                            </span>
                          )}
                          {submission.verification_status === "not_found" && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                              Not Found
                            </span>
                          )}
                          {submission.status === "pending" && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                              Pending
                            </span>
                          )}
                          {submission.status === "approved" && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Approved
                            </span>
                          )}
                          {submission.status === "rejected" && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                      {submission.review_notes && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Admin Notes:</span> {submission.review_notes}
                          </p>
                        </div>
                      )}
                      {submission.reviewed_at && (
                        <div className="mt-2 text-xs text-gray-500">
                          Reviewed: {new Date(submission.reviewed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}