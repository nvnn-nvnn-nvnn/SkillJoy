# Database Seeding Scripts

## Seed Test Users

This script creates placeholder users in your Supabase database with randomized data.

### Setup

1. Make sure your `.env` file has the correct Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Install dependencies if not already installed:
   ```bash
   npm install dotenv
   ```

### Usage

**Create 20 users (default):**
```bash
node scripts/seed-users.js
```

**Create a custom number of users:**
```bash
node scripts/seed-users.js 50
```

### What Gets Created

Each user will have:
- **Random name** from common first/last name combinations
- **Email**: `firstname.lastname###@example.com`
- **Password**: `password123` (same for all test users)
- **Bio**: Random template from a curated list
- **Skills to teach**: 2-5 random skills with star ratings (2-5 stars)
- **Skills to learn**: 2-4 random skills (different from teach skills)
- **Availability**: 3-7 random time slots
- **Points**: Random amount between 0-500

### Example Output

```
✅ Created user: Emma Johnson (emma.johnson42@example.com)
   Teaches: Python, Guitar, Photography
   Learns: Spanish, Cooking
   Points: 234
```

### Login Credentials

All test users use the password: **password123**

You can log in with any generated email (check console output for emails).

### Notes

- The script includes a 500ms delay between user creations to avoid rate limiting
- Failed user creations are logged but don't stop the script
- Duplicate emails are handled gracefully by Supabase
