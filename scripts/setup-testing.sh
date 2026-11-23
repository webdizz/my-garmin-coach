#!/bin/bash
cd "$(dirname "$0")/.."
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest
echo "✓ Testing dependencies installed"
