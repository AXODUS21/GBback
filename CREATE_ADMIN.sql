-- SQL Script to Create Admin Account
-- Run this in the Supabase SQL Editor
-- Replace the email and password with your desired admin credentials

-- Step 1: Create the auth user (Supabase will handle password hashing)
-- Note: You'll need to use the Supabase Auth Admin API or dashboard to create users
-- This SQL shows the manual process, but you may need to use the Supabase Dashboard > Authentication > Users

-- First, insert into auth.users (this requires admin privileges)
-- Go to Supabase Dashboard > Authentication > Users > Add User
-- Create a user with:
--   Email: your-admin-email@example.com
--   Password: your-secure-password
--   Auto Confirm User: YES (checked)

-- Step 2: After creating the auth user, get their UUID from auth.users table
-- Then run this to create their profile with admin role:

-- Replace 'USER_UUID_HERE' with the actual UUID from auth.users
-- You can find it in Supabase Dashboard > Authentication > Users > Click on the user > Copy the UUID

INSERT INTO public.user_profiles (id, email, role)
VALUES (
  'USER_UUID_HERE'::uuid,  -- Replace with actual UUID
  'your-admin-email@example.com',  -- Replace with admin email
  'admin'
)
ON CONFLICT (id) 
DO UPDATE SET role = 'admin', email = EXCLUDED.email;

-- Example for creating the first admin:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" 
-- 3. Enter:
--    - Email: admin@globalbrightfutures.org
--    - Password: [your secure password]
--    - Check "Auto Confirm User"
-- 4. Click "Create User"
-- 5. Copy the UUID from the user details
-- 6. Run this SQL (replace UUID and email):

-- INSERT INTO public.user_profiles (id, email, role)
-- VALUES (
--   'PASTE_UUID_HERE'::uuid,
--   'admin@globalbrightfutures.org',
--   'admin'
-- );

-- Alternative: Using Supabase Management API (requires service role key)
-- You can also use the Supabase client library to create admin users programmatically
-- But for security, manual creation through dashboard is recommended
