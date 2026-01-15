import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Verify environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables are missing!')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('Current values:', {
    url: supabaseUrl || 'NOT SET',
    key: supabaseAnonKey ? 'SET (hidden)' : 'NOT SET'
  })
}

// Verify it's the correct project (NGO)
const expectedProjectId = 'ommmrstanzxkgnlzqwwx'
const expectedUrl = `https://${expectedProjectId}.supabase.co`
if (supabaseUrl && supabaseUrl !== expectedUrl) {
  console.warn('⚠️ WARNING: Supabase URL does not match expected NGO project!')
  console.warn('Expected:', expectedUrl)
  console.warn('Current:', supabaseUrl)
  console.warn('This might be connecting to the wrong database!')
} else if (supabaseUrl === expectedUrl) {
  console.log('✅ Connected to correct Supabase project (NGO):', supabaseUrl)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


