FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx prisma generate && npx next build
ENV NODE_ENV=production
EXPOSE 3000
# Creates/updates tables, seeds Lifetone if empty (safe to re-run), then starts the app.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db seed && npx next start -H 0.0.0.0 -p 3000"]
