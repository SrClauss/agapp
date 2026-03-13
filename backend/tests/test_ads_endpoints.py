import pytest
from httpx import AsyncClient
from app.main import app
from app.core.database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase

@pytest.mark.asyncio
async def test_mobile_banner_db_roundtrip(monkeypatch):
    # prepare a temporary in-memory database stub or use real test db
    db: AsyncIOMotorDatabase = await get_database()
    # clean ads
    await db.ad_contents.delete_many({})

    # insert a banner entry for client
    from app.models.banner import Banner
    banner_obj = Banner(
        alias="banner_client_home",
        target="client",
        base64="data:image/png;base64,AAA",
        onPress_type="external_link",
        onPress_link="https://example.com",
        position=3,
        is_active=True
    )
    await db.ad_contents.insert_one(banner_obj.dict(by_alias=True, exclude_none=True))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        # check endpoint
        r = await ac.get("/system-admin/api/public/ads/banner_client/check")
        assert r.status_code == 200
        assert r.json()["exists"] is True

        # fetch ad
        r2 = await ac.get("/system-admin/api/public/ads/banner_client")
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("base64") == "data:image/png;base64,AAA"
        assert data.get("onPress_link") == "https://example.com"
        assert data.get("position") == 3
        assert data.get("target") == "client"

    # ensure file-based logic still works if we remove base64
    await db.ad_contents.delete_many({})
    # simulate no db record; file-based media not tested here

    r3 = await ac.get("/system-admin/api/public/ads/banner_client/check")
    # depending on filesystem state may return 204 or exists false; at least no exception
    assert r3.status_code in (200, 204, 404)



@pytest.mark.asyncio
async def test_mobile_publi_screen_db_roundtrip(monkeypatch):
    db: AsyncIOMotorDatabase = await get_database()
    await db.publi_screen_ads.delete_many({})

    from app.models.publi_screen_ad import PubliScreenAd
    fake_zip_bytes = b"PK\x03\x04fake zip content"
    pub_obj = PubliScreenAd(
        alias="publi_client",
        target="client",
        zip_blob=fake_zip_bytes,
        onClose_redirect="https://closing.example",
        pressables=[{"left":10,"top":10,"width":50,"height":50,"onPress_type":"external_link","onPress_link":"https://press.example"}],
        is_active=True
    )
    await db.publi_screen_ads.insert_one(pub_obj.dict(by_alias=True, exclude_none=True))

    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.get("/system-admin/api/public/ads/publi_client/check")
        assert r.status_code == 200
        assert r.json()["exists"] is True

        r2 = await ac.get("/system-admin/api/public/ads/publi_client")
        assert r2.status_code == 200
        data = r2.json()
        import base64 as b64mod
        assert data.get("zip_base64") == b64mod.b64encode(fake_zip_bytes).decode('utf-8')
        assert data.get("onClose_redirect") == "https://closing.example"
        assert isinstance(data.get("pressables"), list)
        assert data.get("target") == "client"

    await db.publi_screen_ads.delete_many({})
    r3 = await ac.get("/system-admin/api/public/ads/publi_client/check")
    assert r3.status_code in (200, 204, 404)
