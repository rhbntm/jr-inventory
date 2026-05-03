#!/bin/sh

echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting the application..."
exec node server.js
