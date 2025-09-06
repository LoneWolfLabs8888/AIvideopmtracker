# Deployment Instructions

## Netlify Deployment

### Environment Variables Setup

1. **Local Development:**
   - Copy `env.template` to `.env`
   - Replace the placeholder values with your actual Supabase credentials

2. **Netlify Deployment:**
   - Go to your Netlify dashboard
   - Navigate to Site Settings → Environment Variables
   - Add these variables:
     - `VITE_SUPABASE_URL` = your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anonymous key

### Secrets Scanning Configuration

The `netlify.toml` file is configured to ignore the Supabase environment variables during secrets scanning, as these are expected to be present in the built JavaScript file for frontend applications.

### Build Process

The application uses Vite, which replaces `import.meta.env.VITE_*` variables with their actual values during build time. This is the expected behavior for frontend applications.

## Troubleshooting

If you encounter secrets scanning errors:
1. Ensure your environment variables are properly set in Netlify
2. Check that the `netlify.toml` file includes the `omit_keys` configuration
3. Verify that your `.env` file is not committed to version control (it's in `.gitignore`)
