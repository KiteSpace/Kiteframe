#!/bin/bash
set -e

# Install dependencies
npm install

# Push schema changes to the database (non-interactive after column alignment)
npm run db:push -- --force
