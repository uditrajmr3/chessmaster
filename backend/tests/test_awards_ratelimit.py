from app.services.awards.ratelimit import SlidingWindowLimiter


def test_allows_up_to_the_cap():
    lim = SlidingWindowLimiter(max_events=3, window_seconds=60)
    assert [lim.allow("ip", now=t) for t in (0, 1, 2)] == [True, True, True]


def test_blocks_beyond_the_cap_within_the_window():
    lim = SlidingWindowLimiter(max_events=2, window_seconds=60)
    lim.allow("ip", now=0); lim.allow("ip", now=1)
    assert lim.allow("ip", now=2) is False


def test_allows_again_once_the_window_slides_past():
    lim = SlidingWindowLimiter(max_events=1, window_seconds=60)
    lim.allow("ip", now=0)
    assert lim.allow("ip", now=61) is True


def test_keys_are_tracked_independently():
    lim = SlidingWindowLimiter(max_events=1, window_seconds=60)
    lim.allow("a", now=0)
    assert lim.allow("b", now=0) is True
