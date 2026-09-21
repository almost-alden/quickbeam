/**
 * Shared store constants. Kept in their own module so the store adapters
 * can use them without a require cycle back through ./index.js.
 */

const DEFAULT_MAGIC_LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_DEVICE_TTL_MS = 60 * 60 * 1000; // 1h

const DEFAULT_COLLECTION_MAGIC = 'magic_links';
const DEFAULT_COLLECTION_DEVICES = 'devices';
const DEFAULT_COLLECTION_PAIRING_CODES = 'pairing_codes';

module.exports = {
    DEFAULT_MAGIC_LINK_TTL_MS,
    DEFAULT_DEVICE_TTL_MS,
    DEFAULT_COLLECTION_MAGIC,
    DEFAULT_COLLECTION_DEVICES,
    DEFAULT_COLLECTION_PAIRING_CODES,
};
