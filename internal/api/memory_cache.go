package api

import (
	"sync"
	"time"
)

type cacheEntry struct {
	value     any
	expiresAt time.Time
}

// memoryCache stores disposable Jira metadata in the server process.
// Jira remains the source of truth; expired or missing entries are fetched again.
type memoryCache struct {
	mu         sync.Mutex
	entries    map[string]cacheEntry
	maxEntries int
}

func newMemoryCache(maxEntries int) *memoryCache {
	return &memoryCache{
		entries:    make(map[string]cacheEntry),
		maxEntries: maxEntries,
	}
}

func (c *memoryCache) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		delete(c.entries, key)
		return nil, false
	}
	return entry.value, true
}

func (c *memoryCache) Set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	for entryKey, entry := range c.entries {
		if now.After(entry.expiresAt) {
			delete(c.entries, entryKey)
		}
	}

	_, replacingExisting := c.entries[key]
	if c.maxEntries > 0 && !replacingExisting && len(c.entries) >= c.maxEntries {
		var oldestKey string
		var oldestExpiry time.Time
		for entryKey, entry := range c.entries {
			if oldestKey == "" || entry.expiresAt.Before(oldestExpiry) {
				oldestKey = entryKey
				oldestExpiry = entry.expiresAt
			}
		}
		delete(c.entries, oldestKey)
	}

	c.entries[key] = cacheEntry{value: value, expiresAt: now.Add(ttl)}
}

func (c *memoryCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]cacheEntry)
}
