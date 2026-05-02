#!/bin/sh

# Create a temporary .env file for Prisma to read
# We dump the relevant environment variables into it to satisfy any
# Prisma/NextAuth configuration that specifically looks for a .env file.
echo "DATABASE_URL=\"$DATABASE_URL\"" > .env
echo "NEXTAUTH_URL=\"$NEXTAUTH_URL\"" >> .env
echo "NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"" >> .env
echo "GOOGLE_CLIENT_ID=\"$GOOGLE_CLIENT_ID\"" >> .env
echo "GOOGLE_CLIENT_SECRET=\"$GOOGLE_CLIENT_SECRET\"" >> .env

echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting the application..."
exec node server.js
