# Deployment Guide - PrithviX Partner Web

Complete guide for deploying to Vercel (recommended) and other platforms.

---

## 🚀 Vercel Deployment (Recommended)

### Prerequisites
- Vercel account (free tier sufficient)
- GitHub/GitLab/Bitbucket repository
- Supabase project
- Google Maps API key (optional)

### Step 1: Prepare Repository

```bash
# Ensure .env.local is in .gitignore (already done)
# Commit latest changes
git add .
git commit -m "Production ready"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your repository
4. Framework preset should auto-detect as **Next.js**

### Step 3: Configure Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

| Key | Value | Source |
|-----|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSy...` | Google Cloud Console (optional) |

**Important:** Set these for all environments (Production, Preview, Development)

### Step 4: Deploy

1. Click **Deploy**
2. Wait 2-3 minutes for build
3. Access your app at `https://your-project.vercel.app`

### Step 5: Configure Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Wait for SSL certificate (automatic)

### Step 6: Verify Deployment

Test these features:
- ✅ Login works
- ✅ Farmers list loads
- ✅ Invoice PDF downloads
- ✅ Map displays (if API key set)
- ✅ Dark mode toggle
- ✅ Mobile responsive

---

## 🐳 Docker Deployment

### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  prithvix-web:
    build:
      context: .
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Build & Run

```bash
# Build image
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key \
  -t prithvix-web .

# Run container
docker run -p 3000:3000 prithvix-web

# Or use docker-compose
docker-compose up -d
```

---

## 🌐 Netlify Deployment

### netlify.toml

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Deploy Steps

1. Go to [app.netlify.com/start](https://app.netlify.com/start)
2. Connect Git repository
3. Set build command: `npm run build`
4. Set publish directory: `.next`
5. Add environment variables (same as Vercel)
6. Click Deploy

---

## ☁️ AWS Amplify Deployment

### amplify.yml

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### Deploy Steps

1. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Connect repository
4. Add environment variables
5. Deploy

---

## 🔐 Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | For Sales Territory Map feature | `AIzaSyAbc123...` |

---

## 🛡️ Security Checklist

Before deploying to production:

- [ ] Environment variables NOT committed to Git
- [ ] `.env.local` in `.gitignore`
- [ ] Supabase RLS policies enabled
- [ ] HTTPS only in production
- [ ] API keys restricted to production domain
- [ ] Error tracking configured (Sentry, LogRocket)
- [ ] Rate limiting configured (Vercel Edge Config)
- [ ] CSP headers configured (see `vercel.json`)

---

## 📊 Monitoring & Analytics

### Vercel Analytics

Already configured! View in Vercel dashboard:
- Page views
- Web Vitals (LCP, FID, CLS)
- Real User Monitoring

### Google Analytics (Optional)

Add to `app/layout.tsx`:

```typescript
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=G-YOUR-ID`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YOUR-ID');
          `}
        </Script>
      </body>
    </html>
  );
}
```

### Sentry Error Tracking (Recommended)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Follow wizard to configure. Update `ErrorBoundary.tsx` to use Sentry.

---

## 🧪 Pre-Deployment Testing

```bash
# 1. Type check
npm run type-check

# 2. Lint
npm run lint

# 3. Build locally
npm run build

# 4. Test production build
npm start
# Open http://localhost:3000

# 5. Lighthouse audit
# Use Chrome DevTools → Lighthouse tab
```

**Target Scores:**
- Performance: >85
- Accessibility: >95
- Best Practices: >90
- SEO: >90

---

## 🚨 Troubleshooting Deployments

### Build Fails on Vercel

**Error:** `Module not found`
```bash
# Solution: Clear build cache
vercel --force
```

**Error:** `Environment variable missing`
```bash
# Solution: Check all vars are set for Production environment
# Go to Settings → Environment Variables
```

### Slow Build Times

```bash
# Add to package.json
"scripts": {
  "postinstall": "prisma generate" // If using Prisma
}
```

### Runtime Errors

**Issue:** 500 errors after deployment
**Check:**
1. Vercel Functions logs
2. Environment variables
3. Supabase connection

**Issue:** API routes not working
**Check:**
1. Middleware configuration
2. Supabase client initialization
3. Cookie settings

---

## 📞 Support

For deployment issues:
1. Check Vercel deployment logs
2. Review [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
3. Contact support@prithvix.com

---

**Happy Deploying! 🎉**
