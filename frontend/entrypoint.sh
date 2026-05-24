#!/bin/sh
set -e

if [ ! -d node_modules/express ]; then
  echo "Installing frontend dependencies"
  npm ci --silent 2>/dev/null || npm install --silent
fi

echo "Starting Vite dev server"
npm run dev -- --host 0.0.0.0 &
VITE_PID=$!

echo "Starting bridge supervisor on port ${SUPERVISOR_PORT:-3001}"
node ./bridge-supervisor/index.js &
SUPERVISOR_PID=$!

trap 'kill $VITE_PID $SUPERVISOR_PID 2>/dev/null; exit 0' INT TERM

wait $VITE_PID $SUPERVISOR_PID
