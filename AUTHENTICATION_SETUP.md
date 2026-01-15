# Authentication System Setup Guide

## Overview
The backend now uses Supabase Auth for authentication with role-based access control:
- **Admins**: Can approve/reject school signups and manage scholarship applications
- **Schools**: Can submit scholarship applications after approval

## Creating Admin Accounts

Admin accounts must be created manually through the Supabase Dashboard. Follow these steps:

### Step 1: Create Auth User
1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User" button
3. Fill in:
   - **Email**: Your admin email (e.g., `admin@globalbrightfutures.org`)
   - **Password**: A secure password
   - **Auto Confirm User**: ✅ Check this box
4. Click "Create User"
5. **Copy the UUID** from the user details (you'll need it for the next step)

### Step 2: Set Admin Role
Run this SQL in the Supabase SQL Editor:

```sql
-- Replace 'USER_UUID_HERE' with the UUID from Step 1
-- Replace 'admin@globalbrightfutures.org' with the actual email

INSERT INTO public.user_profiles (id, email, role)
VALUES (
  'USER_UUID_HERE'::uuid,
  'admin@globalbrightfutures.org',
  'admin'
)
ON CONFLICT (id) 
DO UPDATE SET role = 'admin', email = EXCLUDED.email;
```

### Example
If your UUID is `123e4567-e89b-12d3-a456-426614174000` and email is `admin@globalbrightfutures.org`:

```sql
INSERT INTO public.user_profiles (id, email, role)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000'::uuid,
  'admin@globalbrightfutures.org',
  'admin'
)
ON CONFLICT (id) 
DO UPDATE SET role = 'admin', email = EXCLUDED.email;
```

## School Registration Flow

1. **School Signs Up**: Goes to `/auth/signup` and fills out school registration form
2. **Pending Approval**: Account is created but cannot access application form
3. **Admin Approval**: Admin reviews signup in `/admin/school-signups` and approves/rejects
4. **School Can Apply**: Once approved, school can log in and access `/apply` to submit scholarship applications

## User Roles

### Admin
- Access: `/` (Dashboard), `/admin/school-signups`, `/vouchers`
- Can: Approve/reject schools, approve/reject applications, view all data

### School
- Access: `/apply` (Application Form)
- Can: Submit scholarship applications for their students

## Authentication Pages

- `/auth/login` - Login page (for both admins and schools)
- `/auth/signup` - School registration page
- `/auth` - Redirects to `/auth/login`

## Protected Routes

All dashboard routes require authentication:
- Admins are redirected to `/auth/login` if not authenticated
- Schools are redirected to `/auth/login` if not authenticated or not approved

## Environment Variables

Make sure your `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ommmrstanzxkgnlzqwwx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Troubleshooting

### "Your school account is pending approval"
- School has signed up but admin hasn't approved yet
- Admin needs to go to `/admin/school-signups` and approve

### "Only approved schools can submit applications"
- School tried to access `/apply` before approval
- Wait for admin approval or check if already approved

### Can't log in as admin
- Verify user exists in `auth.users`
- Verify `user_profiles` has the correct UUID with `role = 'admin'`
- Check email/password are correct
