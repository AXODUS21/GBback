# Environment Variables Setup for GBbackend

## CRITICAL: Backend Must Connect to NGO Project

The backend dashboard MUST connect to the **NGO** Supabase project to see the applications submitted from the frontend.

## Required Environment Variables

Create a `.env.local` file in the `GBbackend/` directory with these values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ommmrstanzxkgnlzqwwx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<use_one_of_the_keys_below>
```

## API Keys (Choose ONE)

### Option 1: Legacy Anon Key (Recommended)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tbW1yc3Rhbnp4a2dubHpxd3d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNzg1NzMsImV4cCI6MjA4MTk1NDU3M30.x0ufLLUK3LqSoHvFDxOm96750EPnqODuyX44A1j82LI
```

### Option 2: Publishable Key
```
sb_publishable_ronrFtU6cS2kWuwTz4kI3w_3RgVl-qx
```

## Email Configuration (Optional)

If you want email notifications to work:

```env
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=Global Bright Futures <noreply@globalbrightfutures.org>
```

## Complete .env.local Example

```env
# Supabase Configuration - NGO Project
NEXT_PUBLIC_SUPABASE_URL=https://ommmrstanzxkgnlzqwwx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tbW1yc3Rhbnp4a2dubHpxd3d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNzg1NzMsImV4cCI6MjA4MTk1NDU3M30.x0ufLLUK3LqSoHvFDxOm96750EPnqODuyX44A1j82LI

# Email Configuration (Optional)
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=Global Bright Futures <noreply@globalbrightfutures.org>
```

## Steps to Fix Connection

1. **Create `.env.local` file** in `GBbackend/` directory
2. **Copy the environment variables** from above
3. **Stop the development server** (Ctrl+C)
4. **Restart the development server** (`npm run dev`)
5. **Check the browser console** - you should see:
   - ✅ "Connected to correct Supabase project (NGO): https://ommmrstanzxkgnlzqwwx.supabase.co"
   - If you see a warning, the URL is wrong!

## Verification

After setting up, check the browser console when loading the dashboard:
- Should show the correct Supabase URL
- Should load all 3 pending applications from the NGO database

## Important Notes

- ⚠️ The `.env.local` file is in `.gitignore` - it will NOT be committed to git
- ⚠️ You must restart the server after changing environment variables
- ⚠️ Both GBfrontend and GBbackend MUST use the SAME Supabase project (NGO)
