#!/bin/bash
# setup-frontend.sh
# Run this AFTER npx hardhat compile to inject the bytecode into app.html

echo "Extracting bytecode from compiled contract..."

# Extract bytecode from Hardhat artifacts
BYTECODE=$(python3 -c "
import json
with open('artifacts/contracts/PharmaceuticalSupplyChain.sol/PharmaceuticalSupplyChain.json') as f:
    data = json.load(f)
    print(data['bytecode'])
")

if [ -z "$BYTECODE" ]; then
    echo "ERROR: Could not extract bytecode. Make sure you ran 'npx hardhat compile' first."
    exit 1
fi

echo "Bytecode extracted (${#BYTECODE} chars)"

# Replace placeholder in app.html
sed -i.bak "s|PASTE_YOUR_BYTECODE_HERE|$BYTECODE|g" frontend/app.html

echo "Done! Bytecode injected into frontend/app.html"
echo ""
echo "To run the demo:"
echo "  1. Terminal 1: npx hardhat node"
echo "  2. Terminal 2: open frontend/app.html in Chrome"
echo "  3. Click 'Deploy Contract & Connect'"
echo ""
