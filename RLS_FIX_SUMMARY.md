# RLS Recursion Fix Summary

## Problem
Getting "infinite recursion detected in policy for relation 'user_profiles'" error when trying to log in as admin.

## Root Cause
The RLS policy "Admins can view all profiles" was checking if a user is admin by querying the same `user_profiles` table it's protecting, creating a circular dependency:

```sql
-- PROBLEMATIC (causes recursion):
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles  -- ← Queries the same table!
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

When the policy tries to check the role, it queries `user_profiles`, which triggers the policy again, which queries `user_profiles` again... infinite loop!

## Solution
Created a `SECURITY DEFINER` function that bypasses RLS when checking admin status:

```sql
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- Runs with elevated privileges, bypasses RLS
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;
```

Now policies can use this function without recursion:

```sql
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));  -- Uses function, no recursion!
```

## What Was Fixed

1. **Created `is_admin()` function** - Security definer function to check admin status
2. **Fixed `user_profiles` policies** - Removed circular dependencies
3. **Fixed `school_profiles` policies** - Updated to use the function
4. **Fixed `school_signups` policies** - Updated to use the function
5. **Fixed `scholarship_applications` policies** - Updated to use the function

## Testing

After this fix, you should be able to:
1. ✅ Log in as admin without recursion errors
2. ✅ View your own profile
3. ✅ Admins can view all profiles
4. ✅ Schools can view their own profiles
5. ✅ All other role-based access should work correctly

## How Security Definer Works

- `SECURITY DEFINER` functions run with the privileges of the user who created them (usually postgres)
- This means they bypass RLS policies
- This is safe because the function only checks admin status, not sensitive data
- The function is `STABLE` meaning it doesn't modify data and can be optimized

If you still get errors, try logging out and logging back in, or clear your browser's localStorage/cookies.
