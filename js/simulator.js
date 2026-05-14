/**
 * simulator.js
 * Interactive blockchain mining simulator.
 *
 * Uses the Web Crypto API (SHA-256) for real hashing.
 * Demonstrates proof-of-work (nonce mining), block linking,
 * and chain immutability — all in plain JavaScript.
 */

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Stores the current state of each block.
 * minedHash is null until the block has been successfully mined.
 */
const blockState = {
    1: { nonce: 0, minedHash: null, data: '' },
    2: { nonce: 0, minedHash: null, data: '' },
    3: { nonce: 0, minedHash: null, data: '' },
};

// The genesis previous hash (all zeros — standard convention)
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// Proof-of-work difficulty: hash must start with this prefix
const DIFFICULTY_PREFIX = '00';

// ─── Crypto Helpers ───────────────────────────────────────────────────────────

/**
 * Computes SHA-256 of a string using the Web Crypto API.
 * @param {string} message
 * @returns {Promise<string>} hex-encoded hash
 */
async function sha256(message) {
    const encoder = new TextEncoder();
    const data    = encoder.encode(message);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the previous hash for a given block number.
 * Block 1 uses the genesis hash; others use the mined hash of the prior block.
 * @param {number} blockNum
 * @returns {string}
 */
function getPrevHash(blockNum) {
    if (blockNum === 1) return GENESIS_HASH;
    return blockState[blockNum - 1].minedHash ?? '—';
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

/**
 * Sets the visual status badge on a block card.
 * @param {number} blockNum
 * @param {'valid'|'invalid'|'pending'|'waiting'} state
 */
function setBlockStatus(blockNum, state) {
    const statusEl = document.getElementById(`block${blockNum}-status`);
    const cardEl   = document.getElementById(`block${blockNum}-card`);

    // Remove all state classes
    statusEl.className = 'block-status';
    cardEl.className   = 'block-card';

    switch (state) {
        case 'valid':
            statusEl.classList.add('valid');
            statusEl.textContent = '✅ Valid';
            cardEl.classList.add('valid');
            break;
        case 'invalid':
            statusEl.classList.add('invalid');
            statusEl.textContent = '❌ Invalid';
            cardEl.classList.add('invalid');
            break;
        case 'pending':
            statusEl.textContent = '⏳ Not Mined';
            break;
        case 'waiting':
            statusEl.textContent = `⏳ Waiting for Block ${blockNum - 1}`;
            break;
    }
}

/**
 * Updates the hash display element for a block.
 * @param {number} blockNum
 * @param {string} hash
 */
function setHashDisplay(blockNum, hash) {
    document.getElementById(`block${blockNum}-hash`).textContent = hash || '—';
}

/**
 * Updates the Previous Hash input for a block.
 * @param {number} blockNum
 * @param {string} hash
 */
function setPrevHashDisplay(blockNum, hash) {
    document.getElementById(`block${blockNum}-prevhash`).value = hash;
}

/**
 * Shows or hides the mining progress indicator.
 * @param {number} blockNum
 * @param {boolean} visible
 */
function setMiningProgress(blockNum, visible) {
    const el = document.getElementById(`block${blockNum}-progress`);
    el.classList.toggle('visible', visible);
}

/**
 * Updates the nonce counter shown in the mining progress bar.
 * @param {number} blockNum
 * @param {number} nonce
 */
function updateNonceDisplay(blockNum, nonce) {
    document.getElementById(`block${blockNum}-nonce-display`).textContent = nonce;
    document.getElementById(`block${blockNum}-nonce`).value = nonce;
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Mines a block by incrementing the nonce until the SHA-256 hash
 * starts with DIFFICULTY_PREFIX (simulated proof-of-work).
 *
 * Uses setTimeout batching so the UI stays responsive during mining.
 * @param {number} blockNum
 */
async function mineBlock(blockNum) {
    const mineBtn  = document.getElementById(`block${blockNum}-mine-btn`);
    const dataInput = document.getElementById(`block${blockNum}-data`);
    const prevHash  = getPrevHash(blockNum);

    // Guard: block before this one must be mined first
    if (blockNum > 1 && !blockState[blockNum - 1].minedHash) {
        alert(`Mine Block ${blockNum - 1} first!`);
        return;
    }

    const data = dataInput.value.trim() || `Block ${blockNum} data`;

    // Disable button and show progress
    mineBtn.disabled = true;
    setMiningProgress(blockNum, true);
    setBlockStatus(blockNum, 'pending');

    let nonce = 0;
    let hash  = '';

    // Mine in async batches to keep the UI responsive
    await new Promise(resolve => {
        function mineBatch() {
            const BATCH_SIZE = 500; // hashes per batch before yielding to UI
            let count = 0;

            // We use a synchronous inner loop for speed, but wrap in async for SHA-256
            (async function loop() {
                while (count < BATCH_SIZE) {
                    const input = `${blockNum}${prevHash}${data}${nonce}`;
                    hash = await sha256(input);

                    if (hash.startsWith(DIFFICULTY_PREFIX)) {
                        // Found a valid hash!
                        resolve();
                        return;
                    }

                    nonce++;
                    count++;

                    // Update UI every 100 nonces
                    if (nonce % 100 === 0) {
                        updateNonceDisplay(blockNum, nonce);
                    }
                }

                // Yield to browser, then continue next batch
                updateNonceDisplay(blockNum, nonce);
                setTimeout(mineBatch, 0);
            })();
        }

        mineBatch();
    });

    // ── Mining complete ──
    blockState[blockNum].nonce    = nonce;
    blockState[blockNum].minedHash = hash;
    blockState[blockNum].data     = data;

    // Update UI
    updateNonceDisplay(blockNum, nonce);
    setHashDisplay(blockNum, hash);
    setMiningProgress(blockNum, false);
    setBlockStatus(blockNum, 'valid');
    mineBtn.disabled = false;
    mineBtn.textContent = '✅ Re-Mine Block ' + blockNum;

    // Propagate this block's hash as the next block's Previous Hash
    const nextBlock = blockNum + 1;
    if (nextBlock <= 3) {
        setPrevHashDisplay(nextBlock, hash);
        document.getElementById(`block${nextBlock}-mine-btn`).disabled = false;

        // If next block was already mined, it's now invalid (chain broken)
        if (blockState[nextBlock].minedHash) {
            invalidateChainFrom(nextBlock);
        } else {
            setBlockStatus(nextBlock, 'pending');
        }
    }
}

/**
 * Marks a block and all subsequent blocks as invalid.
 * Called when an earlier block's hash changes.
 * @param {number} startBlockNum
 */
function invalidateChainFrom(startBlockNum) {
    for (let i = startBlockNum; i <= 3; i++) {
        if (blockState[i].minedHash) {
            setBlockStatus(i, 'invalid');
        }
    }
}

/**
 * Recomputes the live (un-mined) hash for a block as the user types.
 * Also invalidates downstream blocks if this block was already mined.
 * @param {number} blockNum
 */
async function recomputeLiveHash(blockNum) {
    const data     = document.getElementById(`block${blockNum}-data`).value.trim();
    const prevHash = getPrevHash(blockNum);
    const nonce    = blockState[blockNum].nonce;

    const input = `${blockNum}${prevHash}${data}${nonce}`;
    const hash  = await sha256(input);

    setHashDisplay(blockNum, hash);

    // If this block was previously mined, its stored hash no longer matches
    if (blockState[blockNum].minedHash && hash !== blockState[blockNum].minedHash) {
        setBlockStatus(blockNum, 'invalid');
        // Cascade: downstream blocks are also now invalid
        invalidateChainFrom(blockNum + 1);
    }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/** Called when Block 1 data input changes */
function onBlock1DataChange() {
    recomputeLiveHash(1);
    // If block 1 was mined, its hash changes → block 2's prevHash is stale
    if (blockState[1].minedHash) {
        invalidateChainFrom(2);
    }
}

/** Called when Block 2 data input changes */
function onBlock2DataChange() {
    recomputeLiveHash(2);
    if (blockState[2].minedHash) {
        invalidateChainFrom(3);
    }
}

/** Called when Block 3 data input changes */
function onBlock3DataChange() {
    recomputeLiveHash(3);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/** Sets up initial UI state on page load */
function init() {
    // Block 1 starts with genesis hash already shown
    setPrevHashDisplay(1, GENESIS_HASH);
    setBlockStatus(1, 'pending');
    setBlockStatus(2, 'waiting');
    setBlockStatus(3, 'waiting');

    // Blocks 2 and 3 mine buttons are disabled until prior block is mined
    document.getElementById('block2-mine-btn').disabled = true;
    document.getElementById('block3-mine-btn').disabled = true;
}

init();
