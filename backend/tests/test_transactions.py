import pytest
from types import SimpleNamespace

from app.crud.transactions import create_credit_transaction

@pytest.mark.asyncio
async def test_create_credit_transaction_inserts(monkeypatch, tmp_path):
    # Use a fake db with a minimal interface
    class FakeCollection(list):
        async def insert_one(self, doc):
            self.append(doc)
            return SimpleNamespace(inserted_id=doc.get('_id'))

    class FakeDB:
        def __init__(self):
            self.credit_transactions = FakeCollection()

    db = FakeDB()

    tx = SimpleNamespace(user_id='u1', type='purchase', credits=10, price=0.0, package_name='Test')

    # Create via schema import to ensure compatibility
    from app.schemas.transaction import CreditTransactionCreate
    tx_schema = CreditTransactionCreate(user_id='u1', type='purchase', credits=10, price=0.0, package_name='Test')

    result = await create_credit_transaction(db, tx_schema)
    assert result.user_id == 'u1'
    assert result.credits == 10
    assert getattr(db.credit_transactions[0],'_id', db.credit_transactions[0].get('_id')) == result.id