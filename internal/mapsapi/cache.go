package mapsapi

import (
	"container/list"
	"context"
	"errors"
	"sync"
	"time"
)

type cachedValue struct {
	key     string
	body    []byte
	expires time.Time
}
type flight struct {
	done chan struct{}
	body []byte
	err  error
}
type cache struct {
	mu      sync.Mutex
	items   map[string]*list.Element
	order   *list.List
	flights map[string]*flight
	bytes   int
}

func newCache() *cache {
	return &cache{items: map[string]*list.Element{}, order: list.New(), flights: map[string]*flight{}}
}

// A caller disconnecting does not cancel the work shared by other callers.
func (c *cache) get(ctx context.Context, key string, ttl time.Duration, load func(context.Context) ([]byte, error)) ([]byte, bool, error) {
	c.mu.Lock()
	if item := c.items[key]; item != nil {
		value := item.Value.(cachedValue)
		if time.Now().Before(value.expires) {
			c.order.MoveToFront(item)
			c.mu.Unlock()
			return value.body, true, nil
		}
		c.remove(item)
	}
	f, exists := c.flights[key]
	if !exists {
		if len(c.flights) >= 128 {
			c.mu.Unlock()
			return nil, false, errors.New("too many pending lookups")
		}
		f = &flight{done: make(chan struct{})}
		c.flights[key] = f
		go func() {
			job, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			body, err := load(job)
			c.mu.Lock()
			defer c.mu.Unlock()
			if err == nil && len(body) < 1<<20 {
				for c.order.Len() >= 2048 || c.bytes+len(body) > 24<<20 {
					c.remove(c.order.Back())
				}
				c.items[key] = c.order.PushFront(cachedValue{key, body, time.Now().Add(ttl)})
				c.bytes += len(body)
			}
			f.body, f.err = body, err
			delete(c.flights, key)
			close(f.done)
		}()
	}
	c.mu.Unlock()
	select {
	case <-ctx.Done():
		return nil, false, ctx.Err()
	case <-f.done:
		return f.body, exists, f.err
	}
}

func (c *cache) remove(element *list.Element) {
	if element == nil {
		return
	}
	value := element.Value.(cachedValue)
	c.bytes -= len(value.body)
	delete(c.items, value.key)
	c.order.Remove(element)
}
