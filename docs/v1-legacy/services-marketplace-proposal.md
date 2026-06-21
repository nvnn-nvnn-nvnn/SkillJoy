# Campus Services Marketplace - Design Proposal

## Vision
Expand SkillJoy from skill-swapping to a full campus services marketplace where students can:
- Offer services (tutoring, photography, errands, rides, etc.)
- Request services they need
- Compensate via skill swaps, money, or hybrid arrangements

---

## Database Schema Changes

### 1. New `service_categories` table
```sql
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  parent_category_id UUID REFERENCES public.service_categories(id)
);

-- Example categories:
-- Academic: Tutoring, Essay Editing, Study Partner
-- Creative: Photography, Videography, Graphic Design, Music Lessons
-- Practical: Laundry Help, Cleaning, Cooking, Errands
-- Transportation: Carpool, Airport Rides, Moving Help
-- Tech: Computer Repair, App Development, Website Building
```

### 2. New `service_listings` table
```sql
CREATE TABLE public.service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Compensation preferences
  accepts_money BOOLEAN DEFAULT false,
  accepts_skills BOOLEAN DEFAULT true,
  price_per_hour DECIMAL(10,2), -- if accepts_money
  preferred_skills TEXT[], -- if accepts_skills
  
  -- Availability
  availability TEXT[], -- same format as profiles
  estimated_duration TEXT, -- "30 min", "1-2 hours", "Flexible"
  
  -- Location
  location_type TEXT, -- 'on_campus', 'remote', 'flexible'
  specific_location TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. New `service_requests` table
```sql
CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  
  -- What they're offering in return
  offering_money BOOLEAN DEFAULT false,
  offering_skills BOOLEAN DEFAULT true,
  budget DECIMAL(10,2), -- if offering_money
  skills_to_trade TEXT[], -- if offering_skills
  
  -- When they need it
  needed_by TIMESTAMPTZ,
  availability TEXT[],
  
  -- Location
  location_type TEXT,
  specific_location TEXT,
  
  -- Status
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Update `profiles` table
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  accepts_payment BOOLEAN DEFAULT false,
  payment_methods JSONB, -- venmo, paypal, etc.
  hourly_rate DECIMAL(10,2),
  service_provider BOOLEAN DEFAULT false,
  service_categories UUID[];
```

### 5. Update `swaps` table to handle services
```sql
ALTER TABLE public.swaps ADD COLUMN IF NOT EXISTS
  service_listing_id UUID REFERENCES public.service_listings(id),
  service_request_id UUID REFERENCES public.service_requests(id),
  compensation_type TEXT, -- 'skill_swap', 'money', 'hybrid'
  agreed_price DECIMAL(10,2),
  payment_status TEXT; -- 'pending', 'paid', 'refunded'
```

---

## UI/UX Changes

### New Pages

1. **Services Browse** (`/services`)
   - Grid/list view of active service listings
   - Filter by category, price range, compensation type
   - Search by keyword

2. **Post a Service** (`/services/new`)
   - Form to create service listing
   - Set compensation preferences
   - Upload portfolio/examples

3. **Request a Service** (`/requests/new`)
   - Form to post what you need
   - Specify budget or skills to trade
   - Set deadline

4. **My Services** (`/my-services`)
   - Manage your active listings
   - View requests for your services
   - Track earnings/trades

### Updated Pages

1. **Matches** - Now shows:
   - Skill swap matches (existing)
   - Service providers who match your requests
   - People requesting services you offer

2. **Profile** - Add sections for:
   - Services offered
   - Payment preferences
   - Portfolio/reviews

3. **Swaps** - Rename to **Bookings** or **Transactions**
   - Handle both skill swaps and service bookings
   - Show payment status
   - Add review/rating system

---

## Feature Additions

### 1. Compensation Negotiation
- Allow users to propose different compensation (e.g., "I can pay $20 OR teach you Python")
- Counter-offers
- Hybrid deals (e.g., "$10 + 1 hour of guitar lessons")

### 2. Reviews & Ratings
```sql
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_id UUID REFERENCES public.swaps(id),
  reviewer_id UUID REFERENCES auth.users(id),
  reviewee_id UUID REFERENCES auth.users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Portfolio/Examples
```sql
CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  service_category_id UUID REFERENCES public.service_categories(id),
  title TEXT,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Verification Badges
- Verified student (via .edu email)
- Background check completed
- Payment verified
- Top-rated provider

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create new database tables
- [ ] Update profile schema
- [ ] Add service categories seed data
- [ ] Create basic service listing form

### Phase 2: Core Features (Week 3-4)
- [ ] Service browsing page
- [ ] Service request posting
- [ ] Updated matching algorithm
- [ ] Compensation negotiation UI

### Phase 3: Payments (Week 5-6)
- [ ] Integrate payment processor (Stripe/PayPal)
- [ ] Payment escrow system
- [ ] Payout management

### Phase 4: Trust & Safety (Week 7-8)
- [ ] Review/rating system
- [ ] Portfolio uploads
- [ ] Verification system
- [ ] Dispute resolution

### Phase 5: Polish (Week 9-10)
- [ ] Mobile optimization
- [ ] Notifications (email/push)
- [ ] Analytics dashboard
- [ ] Marketing site

---

## Example User Flows

### Flow 1: Student needs photography
1. Posts service request: "Need headshots for LinkedIn, budget $50 or can teach web development"
2. Photography students see the request
3. One responds: "I'll do it for $30 + 2 hours of React tutoring"
4. They negotiate and agree
5. Complete the service
6. Both leave reviews

### Flow 2: Student offers tutoring
1. Creates service listing: "Calculus tutoring, $25/hr or skill swap"
2. Another student finds it while browsing
3. Proposes: "Can you do $20/hr?"
4. Provider accepts
5. They schedule via the app
6. After session, student pays via app

---

## Branding Considerations

**Current:** SkillJoy (implies skill-swapping)  
**Options for rebrand:**
- **CampusHub** - broader, marketplace feel
- **UniServe** - university services
- **SwapOrPay** - describes the dual model
- Keep **SkillJoy** but expand tagline to "Skills, Services, and More"

---

## Competitive Advantages

1. **Flexible compensation** - unique hybrid model
2. **Campus-focused** - verified students only
3. **Built-in trust** - reviews + .edu verification
4. **Lower fees** - can undercut TaskRabbit/Thumbtack for campus services
5. **Skill development** - still promotes learning

---

## Revenue Model

1. **Transaction fees** (5-10% on paid services)
2. **Premium listings** (featured placement)
3. **Verification badges** (one-time fee)
4. **University partnerships** (white-label for specific campuses)
