import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('onboarded, region')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarded) redirect('/onboarding')

  return (
    <div className="min-h-screen pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
