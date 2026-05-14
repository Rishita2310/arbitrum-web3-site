/**
 * prices.js
 * Fetches live cryptocurrency prices from the CoinGecko public API.
 * Uses a CORS proxy when running from file:// (local file open).
 */

// Coin configuration
const COINS = [
    { id: 'bitcoin',       name: 'Bitcoin',  symbol: 'BTC', icon: '₿' },
    { id: 'ethereum',      name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
    { id: 'solana',        name: 'Solana',   symbol: 'SOL', icon: '◎' },
    { id: 'matic-network', name: 'Polygon',  symbol: 'MATIC', icon: '⬡' },
    { id: 'arbitrum',      name: 'Arbitrum', symbol: 'ARB', icon: '⚡' },
];

const COIN_IDS = COINS.map(c => c.id).join(',');

// CoinGecko endpoint
const COINGECKO_BASE =
    'https://api.coingecko.com/api/v3/simple/price' +
    `?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true`;

// CORS proxy used as fallback when running from file://
const PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(COINGECKO_BASE)}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a USD price with appropriate decimal places.
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) return '$—';
    if (price >= 1000) {
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
        return '$' + price.toFixed(4);
    } else {
        return '$' + price.toFixed(6);
    }
}

/**
 * Builds the HTML for a single price card.
 */
function buildPriceCard(coin, price, change24h) {
    // Defensive defaults — API sometimes omits fields
    const safePrice  = typeof price    === 'number' ? price    : 0;
    const safeChange = typeof change24h === 'number' ? change24h : 0;

    const isPositive  = safeChange >= 0;
    const arrow       = isPositive ? '▲' : '▼';
    const changeClass = isPositive ? 'positive' : 'negative';
    const changeText  = (isPositive ? '+' : '') + safeChange.toFixed(2) + '%';

    return `
        <div class="price-card">
            <div class="price-card-header">
                <div class="coin-icon">${coin.icon}</div>
                <div>
                    <div class="coin-name">${coin.name}</div>
                    <div class="coin-symbol">${coin.symbol}</div>
                </div>
            </div>
            <div class="price-value">${formatPrice(safePrice)}</div>
            <span class="price-change ${changeClass}">
                ${arrow} ${changeText}
                <small style="opacity:0.7;font-size:0.75rem;margin-left:4px">24h</small>
            </span>
        </div>
    `;
}

/**
 * Renders an error state in the grid.
 */
function renderError(message) {
    document.getElementById('prices-grid').innerHTML = `
        <div class="error-message" style="grid-column: 1 / -1;">
            <p>⚠️ ${message}</p>
            <p style="color:var(--text-muted);font-size:0.85rem;margin-top:8px;">
                Try serving the site via a local server (e.g. <code>python -m http.server 8080</code>)
                or wait a moment and refresh — CoinGecko's free tier has rate limits.
            </p>
        </div>
    `;
}

// ─── Fetch Logic ──────────────────────────────────────────────────────────────

/**
 * Attempts a direct fetch to CoinGecko.
 * Falls back to the allorigins CORS proxy if running from file://.
 * @returns {Promise<object>} parsed price data keyed by coin id
 */
async function fetchCoinData() {
    // Try direct fetch first
    try {
        const res = await fetch(COINGECKO_BASE);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Validate we got at least one coin back
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            return data;
        }
        throw new Error('Empty response from CoinGecko');
    } catch (directErr) {
        console.warn('Direct fetch failed, trying proxy:', directErr.message);
    }

    // Fallback: CORS proxy (wraps response in { contents: "..." })
    const proxyRes = await fetch(PROXY_URL);
    if (!proxyRes.ok) throw new Error(`Proxy HTTP ${proxyRes.status}`);
    const wrapper = await proxyRes.json();
    const data = JSON.parse(wrapper.contents);
    if (!data || typeof data !== 'object') throw new Error('Invalid proxy response');
    return data;
}

/**
 * Main function — fetches prices and renders cards.
 * Called on page load and on Refresh click.
 */
async function fetchPrices() {
    const btn        = document.getElementById('refresh-btn');
    const icon       = document.getElementById('refresh-icon');
    const lastUpdate = document.getElementById('last-updated');
    const grid       = document.getElementById('prices-grid');

    // Show loading state
    btn.disabled = true;
    icon.textContent = '⏳';

    // Show skeleton loaders while fetching
    grid.innerHTML = COINS.map(() => `
        <div class="price-card-skeleton">
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
        </div>
    `).join('');

    try {
        const data = await fetchCoinData();

        let cardsHTML = '';
        for (const coin of COINS) {
            const coinData = data[coin.id];
            if (!coinData) {
                // Coin missing from response — show a placeholder card
                cardsHTML += buildPriceCard(coin, null, null);
                continue;
            }
            cardsHTML += buildPriceCard(coin, coinData.usd, coinData.usd_24h_change);
        }

        grid.innerHTML = cardsHTML;
        lastUpdate.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

    } catch (err) {
        console.error('Price fetch error:', err);
        renderError('Could not fetch prices — ' + err.message);
    } finally {
        btn.disabled = false;
        icon.textContent = '🔄';
    }
}

// Auto-fetch on page load
fetchPrices();
