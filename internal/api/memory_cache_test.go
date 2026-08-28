package api

import (
	"testing"
	"time"
)

func TestMemoryCacheGetSetAndClear(t *testing.T) {
	cache := newMemoryCache(10)
	cache.Set("projects", "cached", time.Minute)

	value, ok := cache.Get("projects")
	if !ok || value != "cached" {
		t.Fatalf("Get() = %v, %v; want cached, true", value, ok)
	}

	cache.Clear()
	if _, ok := cache.Get("projects"); ok {
		t.Fatal("Get() after Clear() returned a cached value")
	}
}

func TestMemoryCacheExpiresEntries(t *testing.T) {
	cache := newMemoryCache(10)
	cache.Set("projects", "cached", -time.Second)

	if _, ok := cache.Get("projects"); ok {
		t.Fatal("Get() returned an expired value")
	}
}

func TestMemoryCacheBoundsEntries(t *testing.T) {
	cache := newMemoryCache(2)
	cache.Set("first", 1, time.Minute)
	cache.Set("second", 2, 2*time.Minute)
	cache.Set("third", 3, 3*time.Minute)

	if _, ok := cache.Get("first"); ok {
		t.Fatal("oldest entry was not evicted")
	}
	if _, ok := cache.Get("second"); !ok {
		t.Fatal("second entry was unexpectedly evicted")
	}
	if _, ok := cache.Get("third"); !ok {
		t.Fatal("third entry was unexpectedly evicted")
	}
}

func TestMemoryCacheReplacingEntryDoesNotEvictAnotherKey(t *testing.T) {
	cache := newMemoryCache(2)
	cache.Set("first", 1, time.Minute)
	cache.Set("second", 2, 2*time.Minute)
	cache.Set("first", 3, 3*time.Minute)

	if _, ok := cache.Get("second"); !ok {
		t.Fatal("replacing an entry unexpectedly evicted another key")
	}
	value, ok := cache.Get("first")
	if !ok || value != 3 {
		t.Fatalf("replaced entry = %v, %v; want 3, true", value, ok)
	}
}
