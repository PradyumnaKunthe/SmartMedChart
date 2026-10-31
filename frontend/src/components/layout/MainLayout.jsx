import { useState } from "react"
import SmartMedChatbot from "../chat/SmartMedChatbot"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import MobileNav from "./MobileNav"

export default function MainLayout({
  children,
  title = "Dashboard",
  subtitle,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 antialiased">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Mobile Navigation Drawer */}
        <MobileNav
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            title={title}
            subtitle={subtitle}
            onMenuClick={() => setMobileMenuOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px] animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Floating SmartMed AI Assistant */}
      <SmartMedChatbot />
    </div>
  )
}