import pytest

from app.crud.user import get_user_stats


class FakeCollection:
    def __init__(self, count=0, find_one_result=None, aggregate_result=None):
        self._count = count
        self._find_one = find_one_result
        self._aggregate = aggregate_result or []

    async def count_documents(self, _filter):
        return self._count

    async def find_one(self, _filter):
        return self._find_one

    def aggregate(self, _pipeline):
        async def gen():
            for item in self._aggregate:
                yield item
        return gen()


class FakeDB:
    def __init__(self, user_doc=None, subscription_doc=None):
        self.projects = FakeCollection(count=0, aggregate_result=[])
        self.contacts = FakeCollection(count=0, aggregate_result=[])
        self.subscriptions = FakeCollection(find_one_result=subscription_doc)
        self.users = FakeCollection(find_one_result=user_doc)


@pytest.mark.asyncio
async def test_get_user_stats_prefers_user_credits_over_subscription():
    user_doc = {"_id": "user1", "credits": 1}
    subscription_doc = {"_id": "sub1", "user_id": "user1", "status": "active", "credits": 10}
    db = FakeDB(user_doc=user_doc, subscription_doc=subscription_doc)

    stats = await get_user_stats(db, "user1")

    assert stats["total_credits"] == 1
    assert stats["active_subscription"]["credits"] == 10


@pytest.mark.asyncio
async def test_get_user_stats_fallback_to_subscription_when_no_user_doc():
    user_doc = None
    subscription_doc = {"_id": "sub1", "user_id": "user1", "status": "active", "credits": 10}
    db = FakeDB(user_doc=user_doc, subscription_doc=subscription_doc)

    stats = await get_user_stats(db, "user1")

    assert stats["total_credits"] == 10
    assert stats["active_subscription"]["credits"] == 10
