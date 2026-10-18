import os
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from app.database.postgres import engine
from app.database.models import Base

QDRANT_PATH = os.getenv("QDRANT_PATH", "./qdrant_storage")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "hrms_crm_data")

print("Connecting to Qdrant...")
client = QdrantClient(path=QDRANT_PATH)

print("Recreating Qdrant collection...")
client.recreate_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=VectorParams(
        size=384,
        distance=Distance.COSINE
    )
)
print(f"✅ Qdrant collection '{COLLECTION_NAME}' ready!")

print("Connecting to PostgreSQL...")
Base.metadata.create_all(bind=engine)
print("✅ PostgreSQL tables created successfully!")

client.close()
print("🎉 FULL DATABASE INITIALIZATION COMPLETE!")