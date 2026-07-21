import Navbar from './Navbar'
import Footer from './Footer'
import AmbientBackground from './AmbientBackground'
import CustomCursor from './CustomCursor'

/** Shared layout boundary for every route. */
export default function AppShell({ children }) {
  return (
    <>
      <CustomCursor />
      <AmbientBackground />
      <Navbar />
      <main className="site-content min-h-[calc(100vh-200px)] pb-8">{children}</main>
      <Footer />
    </>
  )
}

