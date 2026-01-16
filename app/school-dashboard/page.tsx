"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { Ticket, DollarSign, Loader2, Plus, Package, AlertCircle, CheckCircle, XCircle, User, Clock, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type VoucherRequest = {
  id: string
  school_id: string
  requested_amount: number
  purpose: string | null
  student_count: number | null
  status: "pending" | "approved" | "rejected"
  requested_at: string
  reviewed_at: string | null
  review_notes: string | null
}

type Voucher = {
  id: string
  voucher_code: string
  school_id: string
  amount: number
  purpose: string | null
  status: "active" | "used" | "expired" | "cancelled"
  created_at: string
  expires_at: string | null
  used_at: string | null
}

type Vendor = {
  id: string
  vendor_name: string
  vendor_type: string
  country: string
  contact_name: string
  contact_email: string
  status: string
}

export default function SchoolDashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [voucherRequests, setVoucherRequests] = useState<VoucherRequest[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [schoolProfile, setSchoolProfile] = useState<any>(null)
  const [signupStatus, setSignupStatus] = useState<any>(null)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestForm, setRequestForm] = useState({
    requested_amount: "",
    purpose: "",
    student_count: "",
  })

  useEffect(() => {
    checkAuthAndLoad()

    // Set up real-time subscriptions
    const requestsChannel = supabase
      .channel('voucher_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voucher_requests'
        },
        (payload) => {
          console.log('Voucher request change detected:', payload)
          if (schoolProfile) {
            loadVoucherRequests(schoolProfile.id)
          }
        }
      )
      .subscribe()

    const vouchersChannel = supabase
      .channel('vouchers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vouchers'
        },
        (payload) => {
          console.log('Voucher change detected:', payload)
          if (schoolProfile) {
            loadVouchers(schoolProfile.id)
          }
        }
      )
      .subscribe()

    return () => {
      requestsChannel.unsubscribe()
      vouchersChannel.unsubscribe()
    }
  }, [schoolProfile, loadVoucherRequests, loadVouchers])

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

      if (profileError || profile?.role !== "school") {
        toast.error("Access Denied: You must be a school to view this page.")
        router.push("/auth/login")
        return
      }

      // Load school profile
      const { data: schoolData, error: schoolError } = await supabase
        .from("school_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (schoolError || !schoolData) {
        toast.error("School profile not found. Please contact support.")
        router.push("/auth/login")
        return
      }

      setSchoolProfile(schoolData)

      // Load signup status
      const { data: signupData } = await supabase
        .from("school_signups")
        .select("status, reviewed_at, review_notes")
        .eq("user_id", user.id)
        .maybeSingle()

      setSignupStatus(signupData)
      
      await Promise.all([
        loadVoucherRequests(user.id),
        loadVouchers(user.id),
        loadVendors(),
      ])
    } catch (error: any) {
      console.error("Error checking auth:", error)
      toast.error("Failed to load dashboard")
      router.push("/auth/login")
    } finally {
      setIsLoading(false)
    }
  }

  const loadVoucherRequests = async (schoolId: string) => {
    try {
      const { data, error } = await supabase
        .from("voucher_requests")
        .select("*")
        .eq("school_id", schoolId)
        .order("requested_at", { ascending: false })

      if (error) throw error
      setVoucherRequests(data || [])
    } catch (error: any) {
      console.error("Error loading voucher requests:", error)
      toast.error("Failed to load voucher requests")
    }
  }

  const loadVouchers = async (schoolId: string) => {
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setVouchers(data || [])
    } catch (error: any) {
      console.error("Error loading vouchers:", error)
      toast.error("Failed to load vouchers")
    }
  }

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, vendor_type, country, contact_name, contact_email, status")
        .eq("status", "active")
        .order("vendor_name", { ascending: true })

      if (error) throw error
      setVendors(data || [])
    } catch (error: any) {
      console.error("Error loading vendors:", error)
      toast.error("Failed to load vendors")
    }
  }

  const handleRequestVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestForm.requested_amount) {
      toast.error("Please enter a requested amount")
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !schoolProfile) throw new Error("Not authenticated")

      const { error: insertError } = await supabase
        .from("voucher_requests")
        .insert([
          {
            school_id: user.id,
            requested_amount: parseFloat(requestForm.requested_amount),
            purpose: requestForm.purpose || null,
            student_count: requestForm.student_count ? parseInt(requestForm.student_count) : null,
            status: "pending",
          },
        ])

      if (insertError) throw insertError

      toast.success("Voucher request submitted! Admin will review it soon.")
      setRequestForm({
        requested_amount: "",
        purpose: "",
        student_count: "",
      })
      setShowRequestForm(false)
      await loadVoucherRequests(user.id)
    } catch (error: any) {
      console.error("Error submitting voucher request:", error)
      toast.error(error.message || "Failed to submit voucher request")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="lg:pl-64">
          <Header userName="School" role="school" />
          <main className="p-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  const pendingRequests = voucherRequests.filter(r => r.status === "pending")
  const approvedVouchers = vouchers.filter(v => v.status === "active")

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header userName={schoolProfile?.school_name || "School"} role="school" />
        <main className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              School Dashboard
            </h1>
            <p className="text-gray-600">Manage your vouchers and view available vendors</p>
          </div>

          {/* Account Status Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                Account Status
              </CardTitle>
              <CardDescription>Your school account information and approval status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">School Name</p>
                    <p className="font-semibold text-gray-900">{schoolProfile?.school_name || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {signupStatus?.status === "approved" && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Approved
                      </span>
                    )}
                    {signupStatus?.status === "pending" && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Pending Review
                      </span>
                    )}
                    {signupStatus?.status === "waitlisted" && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Waitlisted
                      </span>
                    )}
                    {signupStatus?.status === "rejected" && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Rejected
                      </span>
                    )}
                    {!signupStatus && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium flex items-center gap-1">
                        <Info className="h-4 w-4" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {schoolProfile?.contact_name && (
                    <div>
                      <p className="text-gray-600">Contact Name</p>
                      <p className="font-medium text-gray-900">{schoolProfile.contact_name}</p>
                    </div>
                  )}
                  {schoolProfile?.contact_phone && (
                    <div>
                      <p className="text-gray-600">Contact Phone</p>
                      <p className="font-medium text-gray-900">{schoolProfile.contact_phone}</p>
                    </div>
                  )}
                  {schoolProfile?.school_district && (
                    <div>
                      <p className="text-gray-600">District</p>
                      <p className="font-medium text-gray-900">{schoolProfile.school_district}</p>
                    </div>
                  )}
                  {schoolProfile?.country && (
                    <div>
                      <p className="text-gray-600">Country</p>
                      <p className="font-medium text-gray-900">{schoolProfile.country}</p>
                    </div>
                  )}
                </div>

                {signupStatus?.review_notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-1">Admin Notes</p>
                    <p className="text-sm text-gray-600">{signupStatus.review_notes}</p>
                  </div>
                )}

                {signupStatus?.status === "pending" && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Account Under Review</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Your school registration is currently being reviewed by our administration team. 
                          You will receive an email notification once your account has been approved.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {signupStatus?.status === "waitlisted" && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-900">Account Waitlisted</p>
                        <p className="text-sm text-orange-700 mt-1">
                          Your school registration has been waitlisted. We'll contact you when a spot becomes available.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
                <div className="text-sm text-gray-600">Pending Requests</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{approvedVouchers.length}</div>
                <div className="text-sm text-gray-600">Active Vouchers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-indigo-600">{vendors.length}</div>
                <div className="text-sm text-gray-600">Available Vendors</div>
              </CardContent>
            </Card>
          </div>

          {/* Request Voucher Section */}
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Voucher Requests</CardTitle>
                <CardDescription>Request vouchers for your school</CardDescription>
              </div>
              <Button
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {showRequestForm ? "Cancel" : "Request Voucher"}
              </Button>
            </CardHeader>
            {showRequestForm && (
              <CardContent>
                <form onSubmit={handleRequestVoucher} className="space-y-4">
                  <div>
                    <Label htmlFor="requested_amount">Requested Amount ($) *</Label>
                    <Input
                      id="requested_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={requestForm.requested_amount}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, requested_amount: e.target.value }))}
                      required
                      className="mt-1"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="purpose">Purpose</Label>
                    <Textarea
                      id="purpose"
                      value={requestForm.purpose}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, purpose: e.target.value }))}
                      className="mt-1"
                      placeholder="Describe the purpose of this voucher request..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="student_count">Number of Students</Label>
                    <Input
                      id="student_count"
                      type="number"
                      min="1"
                      value={requestForm.student_count}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, student_count: e.target.value }))}
                      className="mt-1"
                      placeholder="Optional"
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Submit Request
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            )}
          </Card>

          {/* Voucher Requests List */}
          {voucherRequests.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>My Voucher Requests</CardTitle>
                <CardDescription>Track the status of your voucher requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {voucherRequests.map((request) => (
                    <div
                      key={request.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-5 w-5 text-indigo-600" />
                            <span className="font-semibold text-lg">${request.requested_amount}</span>
                            {request.status === "pending" && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                Pending
                              </span>
                            )}
                            {request.status === "approved" && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Approved
                              </span>
                            )}
                            {request.status === "rejected" && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Rejected
                              </span>
                            )}
                          </div>
                          {request.purpose && (
                            <p className="text-sm text-gray-600 mb-2">{request.purpose}</p>
                          )}
                          {request.student_count && (
                            <p className="text-sm text-gray-600">Students: {request.student_count}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Requested: {new Date(request.requested_at).toLocaleString()}
                          </p>
                          {request.review_notes && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Admin Notes:</span> {request.review_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vouchers List */}
          {vouchers.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>My Vouchers</CardTitle>
                <CardDescription>Your approved voucher codes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Ticket className="h-5 w-5 text-indigo-600" />
                            <span className="font-mono font-semibold text-lg">{voucher.voucher_code}</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              {voucher.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                            <span className="font-medium text-gray-900">Amount: ${voucher.amount}</span>
                            {voucher.purpose && <span>Purpose: {voucher.purpose}</span>}
                          </div>
                          <p className="text-xs text-gray-500">
                            Created: {new Date(voucher.created_at).toLocaleString()}
                          </p>
                          {voucher.expires_at && (
                            <p className="text-xs text-gray-500">
                              Expires: {new Date(voucher.expires_at).toLocaleString()}
                            </p>
                          )}
                          {voucher.used_at && (
                            <p className="text-xs text-red-600">
                              Used: {new Date(voucher.used_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Vendors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                Available Vendors
              </CardTitle>
              <CardDescription>Browse vendors you can use your vouchers with</CardDescription>
            </CardHeader>
            <CardContent>
              {vendors.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No vendors available at the moment</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <h3 className="font-semibold text-lg text-gray-900 mb-2">{vendor.vendor_name}</h3>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Type:</span> {vendor.vendor_type}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Country:</span> {vendor.country}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Contact:</span> {vendor.contact_name}
                      </p>
                      <p className="text-sm text-indigo-600">
                        {vendor.contact_email}
                      </p>
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
