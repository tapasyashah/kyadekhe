import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let shouldRedirectToOnboarding = false

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('onboarded, region')
        .eq('id', user.id)
        .single()

      if (!profile?.onboarded) shouldRedirectToOnboarding = true
    }
    // Guests (no user) pass through
  } catch {
    // Supabase unreachable or misconfigured — allow page to render
  }

  if (shouldRedirectToOnboarding) redirect('/onboarding')

  return (
    <div className="min-h-screen pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
