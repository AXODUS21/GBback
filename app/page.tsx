"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LogOut, School, DollarSign, Globe, CheckCircle, XCircle } from "lucide-react"
import Navigation from "@/components/navigation"
import HeroSection from "@/components/hero-section"
import ImpactSection from "@/components/impact-section"
import ProgramFeature from "@/components/program-feature"
import VoucherSystem from "@/components/voucher-system"
import Footer from "@/components/footer"

type Application = {
  id: string
  schoolName: string
  district: string
  contactName: string
  email: string
  phone: string
  voucherAmount: number
  studentCount: number
  programType: string
  status: "pending" | "approved" | "rejected"
  appliedDate: string
  country: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [stats, setStats] = useState({
    totalApplications: 0,
    pending: 0,
    approved: 0,
    totalVouchersIssued: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const isAuth = localStorage.getItem("adminAuth")
    if (!isAuth) {
      router.push("/auth")
      return
    }

    setIsLoading(false)

    // Load applications from localStorage
    const savedApplications = localStorage.getItem("schoolApplications")
    if (savedApplications) {
      const apps = JSON.parse(savedApplications)
      setApplications(apps)
      calculateStats(apps)
    } else {
      // Initialize with demo data
      const demoApplications: Application[] = [
        {
          id: "1",
          schoolName: "Lincoln Elementary School",
          district: "Springfield School District",
          contactName: "Sarah Johnson",
          email: "sjohnson@lincoln.edu",
          phone: "555-0123",
          voucherAmount: 500,
          studentCount: 5,
          programType: "STEM Tutoring",
          status: "pending",
          appliedDate: "2025-01-10",
          country: "USA",
        },
        {
          id: "2",
          schoolName: "Roosevelt High School",
          district: "Metro School District",
          contactName: "Michael Chen",
          email: "mchen@roosevelt.edu",
          phone: "555-0456",
          voucherAmount: 1000,
          studentCount: 10,
          programType: "SEL & Mentorship",
          status: "pending",
          appliedDate: "2025-01-12",
          country: "USA",
        },
        {
          id: "3",
          schoolName: "Greenwood Charter School",
          district: "City Charter Network",
          contactName: "Emily Rodriguez",
          email: "erodriguez@greenwood.org",
          phone: "555-0789",
          voucherAmount: 750,
          studentCount: 8,
          programType: "Reading & Math Support",
          status: "approved",
          appliedDate: "2025-01-05",
          country: "USA",
        },
      ]
      setApplications(demoApplications)
      localStorage.setItem("schoolApplications", JSON.stringify(demoApplications))
      calculateStats(demoApplications)
    }
  }, [router])

  const calculateStats = (apps: Application[]) => {
    setStats({
      totalApplications: apps.length,
      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      totalVouchersIssued: apps.filter((a) => a.status === "approved").reduce((sum, a) => sum + a.voucherAmount, 0),
    })
  }

  const handleStatusChange = (id: string, newStatus: "approved" | "rejected") => {
    const updatedApplications = applications.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    setApplications(updatedApplications)
    localStorage.setItem("schoolApplications", JSON.stringify(updatedApplications))
    calculateStats(updatedApplications)
  }

  const handleLogout = () => {
    localStorage.removeItem("adminAuth")
    router.push("/auth")
  }

  const pendingApplications = applications.filter((a) => a.status === "pending")
  const approvedApplications = applications.filter((a) => a.status === "approved")
  const rejectedApplications = applications.filter((a) => a.status === "rejected")

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Global Bright Futures Foundation</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Navigation />
        <HeroSection />
        <ImpactSection />
        <ProgramFeature />
        <VoucherSystem />
        <Footer />

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApplications}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vouchers Issued</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalVouchersIssued.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>School Applications</CardTitle>
            <CardDescription>Review and manage school voucher applications</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">Pending ({pendingApplications.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedApplications.length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedApplications.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4 mt-4">
                {pendingApplications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending applications</p>
                ) : (
                  pendingApplications.map((app) => (
                    <ApplicationCard key={app.id} application={app} onStatusChange={handleStatusChange} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-4 mt-4">
                {approvedApplications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No approved applications</p>
                ) : (
                  approvedApplications.map((app) => (
                    <ApplicationCard key={app.id} application={app} onStatusChange={handleStatusChange} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4 mt-4">
                {rejectedApplications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No rejected applications</p>
                ) : (
                  rejectedApplications.map((app) => (
                    <ApplicationCard key={app.id} application={app} onStatusChange={handleStatusChange} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function ApplicationCard({
  application,
  onStatusChange,
}: {
  application: Application
  onStatusChange: (id: string, status: "approved" | "rejected") => void
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div>
              <h3 className="font-semibold text-lg">{application.schoolName}</h3>
              <p className="text-sm text-muted-foreground">{application.district}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Contact Person</p>
                <p className="font-medium">{application.contactName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{application.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{application.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Applied Date</p>
                <p className="font-medium">{new Date(application.appliedDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Program Type</p>
                <p className="font-medium">{application.programType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Students</p>
                <p className="font-medium">{application.studentCount} students</p>
              </div>
              <div>
                <p className="text-muted-foreground">Voucher Amount</p>
                <p className="font-medium text-primary">${application.voucherAmount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge
                  variant={
                    application.status === "approved"
                      ? "default"
                      : application.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {application.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {application.status === "pending" && (
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button onClick={() => onStatusChange(application.id, "approved")} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Application
            </Button>
            <Button onClick={() => onStatusChange(application.id, "rejected")} variant="destructive" className="flex-1">
              <XCircle className="mr-2 h-4 w-4" />
              Reject Application
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
